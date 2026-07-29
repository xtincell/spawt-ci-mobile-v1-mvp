-- ============================================================================
-- Migration 0035 — paws_ledger (monnaie d'engagement, append-only strict)
-- ============================================================================
-- Les paws sont la reconnaissance d'engagement du spawter (PRD progression —
-- rappel D2 de 0014 : paws NON-convertibles, jamais un portefeuille). Modèle
-- ledger : chaque événement = une ligne delta ; le solde est une somme, jamais
-- une colonne mutable → l'historique est la preuve.
--
-- Append-only (pattern 0003 durci) :
--   * UPDATE : rejeté par trigger, toujours.
--   * DELETE : rejeté par trigger SAUF cascade depuis spawters (suppression de
--     compte NFR-SEC-04). La décision D1 de 0003 avait renoncé au blocage
--     DELETE car un trigger inconditionnel casse le ON DELETE CASCADE ; ici on
--     obtient les deux : au moment où le cascade delete touche paws_ledger, la
--     ligne parente spawters a déjà disparu — le trigger laisse passer ce cas
--     et rejette tout DELETE direct (spawter encore présent).
-- Date : 2026-07-26

CREATE TABLE public.paws_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spawter_id  uuid NOT NULL REFERENCES public.spawters(id) ON DELETE CASCADE,
  delta       integer NOT NULL CHECK (delta <> 0),
  reason      text NOT NULL
                CHECK (reason IN (
                  'spawt_verifie','avis_publie','badge_obtenu',
                  'defi_collectif','ajustement_admin')),
  -- Référence libre vers l'objet source (spawt_checkin.id, badge, défi…) —
  -- pas de FK : les sources sont hétérogènes et le ledger leur survit.
  ref_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.paws_ledger IS
  'Ledger paws append-only (UPDATE/DELETE rejetés par trigger, cascade compte '
  'supprimé excepté). Solde = vue paws_balance. Écriture par triggers '
  'd''attribution + service_role (ajustement_admin) uniquement.';

CREATE INDEX paws_ledger_spawter_created_idx
  ON public.paws_ledger (spawter_id, created_at DESC);

-- ━━━ Trigger append-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.block_modifications_paws_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Cascade depuis spawters : la ligne parente est déjà supprimée quand le
    -- referential action delete arrive ici → on laisse passer (NFR-SEC-04).
    IF NOT EXISTS (SELECT 1 FROM public.spawters s WHERE s.id = OLD.spawter_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'paws_ledger est append-only : DELETE direct interdit'
      USING ERRCODE = 'P0001';
  END IF;
  RAISE EXCEPTION 'paws_ledger est append-only : UPDATE interdit'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER block_update_delete_paws_ledger
  BEFORE UPDATE OR DELETE ON public.paws_ledger
  FOR EACH ROW EXECUTE FUNCTION public.block_modifications_paws_ledger();

-- ━━━ Vue : paws_balance ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- security_invoker = true → la RLS du ledger s'applique : chaque spawter ne
-- calcule que SON solde, le staff voit tout.
CREATE VIEW public.paws_balance
  WITH (security_invoker = true)
AS
  SELECT spawter_id, sum(delta)::integer AS balance
  FROM public.paws_ledger
  GROUP BY spawter_id;

GRANT SELECT ON public.paws_balance TO authenticated;

COMMENT ON VIEW public.paws_balance IS
  'Solde paws par spawter (somme du ledger). Jamais de colonne solde mutable.';

-- ━━━ Attribution automatique ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- +10 paws : spawt vérifié. Deux chemins réels dans l'app :
--   * INSERT déjà vérifié (Le Guet actif, seed-inventory exclu via is_seed) ;
--   * UPDATE qui passe is_verified false→true (vérification différée).
-- +5 paws : avis publié (note attachée). Même paire INSERT/UPDATE que le
-- recompute ADN de 0025 — une note ÉDITÉE ne re-crédite pas.
-- SECURITY DEFINER : le client n'a aucun droit d'écriture sur paws_ledger,
-- seule cette fonction (owner) peut créditer.
CREATE OR REPLACE FUNCTION public.award_paws_on_spawt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_seed OR NEW.is_cancelled OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.paws_ledger (spawter_id, delta, reason, ref_id)
  VALUES (NEW.spawter_id, 10, 'spawt_verifie', NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_paws_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_seed OR NEW.is_cancelled OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.paws_ledger (spawter_id, delta, reason, ref_id)
  VALUES (NEW.spawter_id, 5, 'avis_publie', NEW.id);
  RETURN NEW;
END;
$$;

-- Spawt vérifié dès l'INSERT (Guet actif).
CREATE TRIGGER trg_award_paws_spawt_insert
  AFTER INSERT ON public.spawt_checkin
  FOR EACH ROW
  WHEN (NEW.is_verified)
  EXECUTE FUNCTION public.award_paws_on_spawt();

-- Spawt qui PASSE vérifié (false→true) — jamais deux fois grâce au WHEN.
CREATE TRIGGER trg_award_paws_spawt_verified
  AFTER UPDATE OF is_verified ON public.spawt_checkin
  FOR EACH ROW
  WHEN (NEW.is_verified AND NOT coalesce(OLD.is_verified, false))
  EXECUTE FUNCTION public.award_paws_on_spawt();

-- Avis attaché dès l'INSERT.
CREATE TRIGGER trg_award_paws_review_insert
  AFTER INSERT ON public.spawt_checkin
  FOR EACH ROW
  WHEN (NEW.note_etoiles IS NOT NULL)
  EXECUTE FUNCTION public.award_paws_on_review();

-- Avis attaché après coup (flux Le Guet : modal avis post-notif, cf. 0025).
CREATE TRIGGER trg_award_paws_review_update
  AFTER UPDATE OF note_etoiles ON public.spawt_checkin
  FOR EACH ROW
  WHEN (OLD.note_etoiles IS NULL AND NEW.note_etoiles IS NOT NULL)
  EXECUTE FUNCTION public.award_paws_on_review();

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.paws_ledger ENABLE ROW LEVEL SECURITY;

-- Owner : lecture seule de son historique.
CREATE POLICY paws_ledger_select_own ON public.paws_ledger
  FOR SELECT TO authenticated
  USING (spawter_id = auth.uid());

-- Staff actif : lecture (support / ajustements via service_role).
CREATE POLICY paws_ledger_select_staff ON public.paws_ledger
  FOR SELECT TO authenticated
  USING (public.is_active_staff());

-- AUCUNE policy INSERT/UPDATE/DELETE : écriture uniquement via les triggers
-- SECURITY DEFINER ci-dessus et service_role (ajustement_admin).
