-- Rollback 0027 — Restaurer la contrainte stricte (supprime d'abord les rows à tiret)

DELETE FROM public.feature_flags WHERE flag_code ~ '-';
ALTER TABLE public.feature_flags DROP CONSTRAINT feature_flags_flag_code_check;
ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_flag_code_check
  CHECK (length(flag_code) >= 1 AND length(flag_code) <= 64 AND flag_code ~ '^[a-z0-9_]+$');
