-- ============================================================================
-- Migration 0046 — user_signals : nouveaux signal_type (Sprint 2)
-- ============================================================================
-- Le CHECK de 0003 fige 9 catégories ('spawt','review','view','save','share',
-- 'search','filter','click','dismiss'). Les nouvelles features émettent 4
-- signaux qui n'y rentrent pas :
--   swipe_like / swipe_pass → Mode Rapide (swipe de suggestions)
--   crew_vote               → Mode Crew (0038)
--   reservation             → Réservation 1-tap (0042)
-- Migration dédiée (plutôt que glissée dans 0032) : un ALTER de contrainte
-- sur une table append-only à fort volume mérite sa propre trace.
-- Le mapping event → signal_type reste figé côté TS (analytics.ts) — à
-- étendre en miroir.
-- Date : 2026-07-26

ALTER TABLE public.user_signals
  DROP CONSTRAINT user_signals_signal_type_check;
ALTER TABLE public.user_signals
  ADD CONSTRAINT user_signals_signal_type_check
    CHECK (signal_type IN (
      'spawt','review','view','save','share',
      'search','filter','click','dismiss',
      'swipe_like','swipe_pass','crew_vote','reservation'));

COMMENT ON COLUMN public.user_signals.signal_type IS
  '13 catégories agrégées : spawt | review | view | save | share | search | '
  'filter | click | dismiss | swipe_like | swipe_pass | crew_vote | '
  'reservation. Mapping event → signal_type figé côté TS (analytics.ts).';
