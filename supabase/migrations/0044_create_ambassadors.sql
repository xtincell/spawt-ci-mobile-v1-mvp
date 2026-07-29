-- ============================================================================
-- Migration 0044 — Ambassadeurs (paliers de parrainage + maturité)
-- ============================================================================
-- Programme ambassadeur : reconnaissance des spawters qui ont fait grandir la
-- Meute via leur referral_code hérité du quiz (0033). Le palier combine
-- filleuls (meute_waitlist.referred_by) ET maturité (stade — un ambassadeur
-- doit connaître le terrain qu'il recommande) :
--   palier 1 : au moins 1 filleul
--   palier 2 : détective ou + ET 5+ filleuls
--   palier 3 : djidji ou +    ET 15+ filleuls
-- L'inscription dans la table = décision humaine (staff/service_role) — la
-- fonction calcule, elle n'inscrit pas.
-- Date : 2026-07-26

CREATE TABLE public.ambassadors (
  spawter_id uuid PRIMARY KEY REFERENCES public.spawters(id) ON DELETE CASCADE,
  palier     smallint NOT NULL CHECK (palier IN (1, 2, 3)),
  since      timestamptz NOT NULL DEFAULT now(),
  notes      text
);

COMMENT ON TABLE public.ambassadors IS
  'Ambassadeurs SPAWT (paliers 1-3). Inscription par le staff (service_role) ; '
  'le palier suggéré vient de compute_ambassador_palier().';

-- ━━━ Fonction : compute_ambassador_palier ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SECURITY DEFINER : meute_waitlist est verrouillée (0033) — seule cette
-- fonction peut compter les filleuls. Retourne NULL si non éligible.
CREATE OR REPLACE FUNCTION public.compute_ambassador_palier(p_spawter uuid)
RETURNS smallint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stade text;
  v_refcode text;
  v_filleuls integer;
BEGIN
  -- Un authentifié ne calcule que SON palier (le nombre de filleuls d'autrui
  -- n'est pas public). Staff/service_role : libre.
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM p_spawter
     AND NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'compute_ambassador_palier forbidden: spawter mismatch auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.stade, s.referral_code INTO v_stade, v_refcode
  FROM public.spawters s WHERE s.id = p_spawter;
  IF NOT FOUND OR v_refcode IS NULL THEN
    RETURN NULL;  -- pas d'héritage quiz = pas de filleuls traçables
  END IF;

  SELECT count(*) INTO v_filleuls
  FROM public.meute_waitlist w
  WHERE w.referred_by = v_refcode;

  IF v_filleuls >= 15 AND v_stade IN ('djidji','guide') THEN
    RETURN 3;
  ELSIF v_filleuls >= 5 AND v_stade IN ('detective','djidji','guide') THEN
    RETURN 2;
  ELSIF v_filleuls >= 1 THEN
    RETURN 1;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.compute_ambassador_palier(uuid) IS
  'Palier ambassadeur suggéré (1/2/3, NULL si non éligible) : filleuls '
  '(meute_waitlist.referred_by = referral_code hérité 0033) croisés au stade.';

REVOKE EXECUTE ON FUNCTION public.compute_ambassador_palier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_ambassador_palier(uuid)
  TO authenticated, service_role;

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;

-- Owner : voit son statut d'ambassadeur.
CREATE POLICY ambassadors_select_own ON public.ambassadors
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

-- Staff : tout (lecture pour tous les actifs, gestion réservée admin).
CREATE POLICY ambassadors_select_staff ON public.ambassadors
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

CREATE POLICY ambassadors_insert_admin ON public.ambassadors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_staff());

CREATE POLICY ambassadors_update_admin ON public.ambassadors
  FOR UPDATE TO authenticated
  USING (public.is_admin_staff())
  WITH CHECK (public.is_admin_staff());

CREATE POLICY ambassadors_delete_admin ON public.ambassadors
  FOR DELETE TO authenticated
  USING (public.is_admin_staff());
