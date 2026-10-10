-- Retire uniquement l'extension 0074, conserve les autres actions et l'audit historique.
-- NOT VALID : les purges déjà journalisées restent lisibles ; aucune nouvelle n'est autorisée.
DO $$ DECLARE v_check text; BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO STRICT v_check FROM pg_constraint
  WHERE conrelid='public.admin_audit_log'::regclass AND conname='admin_audit_log_action_check';
 v_check := replace(v_check, ' OR (action = ''seed_reviews_purge''::text)', '');
 ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_action_check;
 EXECUTE format('ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (%s) NOT VALID',v_check);
END $$;
