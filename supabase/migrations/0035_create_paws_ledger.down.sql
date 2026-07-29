-- Rollback 0035 — Drop paws_ledger + attribution

DROP TRIGGER IF EXISTS trg_award_paws_review_update  ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_award_paws_review_insert  ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_award_paws_spawt_verified ON public.spawt_checkin;
DROP TRIGGER IF EXISTS trg_award_paws_spawt_insert   ON public.spawt_checkin;
DROP FUNCTION IF EXISTS public.award_paws_on_review();
DROP FUNCTION IF EXISTS public.award_paws_on_spawt();

DROP VIEW IF EXISTS public.paws_balance;

DROP TRIGGER IF EXISTS block_update_delete_paws_ledger ON public.paws_ledger;
DROP FUNCTION IF EXISTS public.block_modifications_paws_ledger() CASCADE;
DROP TABLE IF EXISTS public.paws_ledger;
