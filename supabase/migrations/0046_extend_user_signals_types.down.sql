-- Rollback 0046 — Restaure le CHECK 9 types de 0003
--
-- ⚠️ Destructif si des signaux des 4 nouveaux types existent : ils sont
-- supprimés (sinon la contrainte restaurée serait invalide). user_signals est
-- append-only côté clients ; ce DELETE est un acte d'admin de rollback.

DELETE FROM public.user_signals
WHERE signal_type IN ('swipe_like','swipe_pass','crew_vote','reservation');

ALTER TABLE public.user_signals
  DROP CONSTRAINT user_signals_signal_type_check;
ALTER TABLE public.user_signals
  ADD CONSTRAINT user_signals_signal_type_check
    CHECK (signal_type IN (
      'spawt','review','view','save','share',
      'search','filter','click','dismiss'));

COMMENT ON COLUMN public.user_signals.signal_type IS
  '9 catégories agrégées : spawt | review | view | save | share | search | filter | click | dismiss. Mapping event → signal_type figé côté TS (analytics.ts).';
