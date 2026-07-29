-- Rollback 0029 — Retire la suppression de compte self-service

DROP FUNCTION IF EXISTS public.request_account_deletion();
ALTER TABLE public.spawters DROP COLUMN IF EXISTS deletion_requested_at;
