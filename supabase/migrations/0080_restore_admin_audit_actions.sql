-- Restore the audit actions removed by the narrower CHECKs in 0060/0063.
-- Extend the current expression: retain all later additions and existing rows.
DO $$
DECLARE
  v_check text;
  v_action text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT v_check
    FROM pg_constraint WHERE conrelid='public.admin_audit_log'::regclass
    AND conname='admin_audit_log_action_check';
  FOREACH v_action IN ARRAY ARRAY[
    'login_failed','report_kept','report_removed','report_warned','push_campaign',
    'event_create','event_update','event_delete','promo_create','promo_update','promo_delete',
    'challenge_create','challenge_update','suggestion_approve','suggestion_reject',
    'b2b_link','b2b_unlink','flag_update','explore_create','explore_update',
    'explore_delete','explore_publish','explore_unpublish'
  ] LOOP
    IF position(quote_literal(v_action) IN v_check)=0 THEN
      v_check := format('(%s) OR action = %L', v_check, v_action);
    END IF;
  END LOOP;
  ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_action_check;
  EXECUTE format('ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_check CHECK (%s)', v_check);
END $$;
NOTIFY pgrst, 'reload schema';
