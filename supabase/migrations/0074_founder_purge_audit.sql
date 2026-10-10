-- 0063 avait remplacé la liste d'actions et retiré seed_reviews_purge (0054).
-- La purge échouait au dernier INSERT d'audit et sa transaction était annulée.
DO $$ DECLARE v_check text; BEGIN
 SELECT pg_get_expr(conbin, conrelid) INTO STRICT v_check FROM pg_constraint
  WHERE conrelid='public.admin_audit_log'::regclass AND conname='admin_audit_log_action_check';
 ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_action_check;
 EXECUTE format('ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK ((%s) OR action = %L)',v_check,'seed_reviews_purge');
END $$;
