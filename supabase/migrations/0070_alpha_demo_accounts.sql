-- Comptes de démonstration alpha : marqueur attribué par le serveur,
-- suppression explicite et auditée depuis la console admin.
-- Aucune ligne existante n'est marquée ou supprimée par cette migration.

ALTER TABLE public.spawters
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.spawters.is_demo IS
  'Compte synthétique de démonstration alpha. Attribué par service_role/DB uniquement ; distinct des fondateurs is_seed.';

CREATE OR REPLACE FUNCTION public.spawters_protect_demo_marker()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- SECURITY INVOKER : current_user reste le rôle SQL de l'appelant.
  -- Un JWT client (même staff admin) ne peut classer un vrai compte en démo.
  IF NOT pg_has_role(current_user, 'service_role', 'MEMBER') THEN
    IF TG_OP = 'INSERT' THEN NEW.is_demo := false;
    ELSE NEW.is_demo := OLD.is_demo;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER spawters_demo_marker_guard
  BEFORE INSERT OR UPDATE ON public.spawters
  FOR EACH ROW EXECUTE FUNCTION public.spawters_protect_demo_marker();
REVOKE ALL ON FUNCTION public.spawters_protect_demo_marker() FROM PUBLIC, anon, authenticated;

-- 0014 bloquait aussi la cascade de suppression d'un compte portant un titre.
-- Comme paws_ledger (0035), seule la disparition du parent autorise DELETE.
CREATE OR REPLACE FUNCTION public.assert_collection_titres_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.spawters WHERE id = OLD.spawter_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'collection_titres is append-only (PRD section 5.4): DELETE rejected';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD.title_key IS DISTINCT FROM NEW.title_key
    OR OLD.spawter_id IS DISTINCT FROM NEW.spawter_id
    OR OLD.source IS DISTINCT FROM NEW.source
    OR OLD.unlocked_at IS DISTINCT FROM NEW.unlocked_at
  ) THEN
    RAISE EXCEPTION 'collection_titres is append-only: only is_displayed can change';
  END IF;
  RETURN NEW;
END;
$$;

-- Étendre le CHECK réel sans retirer des actions ajoutées entretemps.
DO $$
DECLARE v_check text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT v_check
    FROM pg_constraint
   WHERE conrelid = 'public.admin_audit_log'::regclass
     AND conname = 'admin_audit_log_action_check';
  ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_action_check;
  EXECUTE format(
    'ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK ((%s) OR action = %L)',
    v_check, 'spawter_demo_delete'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_demo_spawter(
  p_spawter_id uuid,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.spawters%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin_staff(v_actor) THEN
    RAISE EXCEPTION 'demo_admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_spawter_id = v_actor THEN
    RAISE EXCEPTION 'demo_self_delete_forbidden' USING ERRCODE = '42501';
  END IF;

  -- Empêche un rattachement staff concurrent pendant le contrôle et la purge.
  PERFORM 1 FROM auth.users WHERE id = p_spawter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'demo_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.spawt_staff WHERE id = p_spawter_id) THEN
    RAISE EXCEPTION 'demo_staff_delete_forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_target FROM public.spawters WHERE id = p_spawter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'demo_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_target.is_demo THEN
    RAISE EXCEPTION 'demo_only' USING ERRCODE = '42501';
  END IF;
  IF v_target.is_seed THEN
    RAISE EXCEPTION 'demo_seed_delete_forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation IS DISTINCT FROM v_target.display_name THEN
    RAISE EXCEPTION 'demo_confirmation_mismatch' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.admin_audit_log
    (spawt_staff_id, action, entity_type, entity_id, payload_before, payload_after, reason)
  VALUES
    (v_actor, 'spawter_demo_delete', 'spawter', p_spawter_id,
     jsonb_build_object('is_demo', true), jsonb_build_object('deleted', true),
     'Suppression explicite d’un compte de démonstration alpha');

  -- auth.sessions/refresh_tokens et les données B2C suivent leurs FK cascade.
  -- Toute erreur de cascade annule aussi l'audit, dans la même transaction.
  DELETE FROM auth.users WHERE id = p_spawter_id;
  RETURN jsonb_build_object('ok', true, 'spawter_id', p_spawter_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_demo_spawter(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_demo_spawter(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.admin_delete_demo_spawter(uuid, text) IS
  'Purge uniquement un compte synthétique is_demo, jamais staff, soi-même, fondateur ou compte réel. Admin actif + confirmation exacte du nom. Audit et cascade atomiques.';

NOTIFY pgrst, 'reload schema';
