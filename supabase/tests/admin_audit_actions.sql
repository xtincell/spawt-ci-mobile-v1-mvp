\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES('dddd0000-0000-4000-8000-0000000080a1','audit-test@spawt.local');
INSERT INTO public.spawt_staff(id,email,display_name,role,is_active)
 VALUES('dddd0000-0000-4000-8000-0000000080a1','audit-test@spawt.local','Recette audit','operator',true);
SELECT set_config('request.jwt.claim.sub','dddd0000-0000-4000-8000-0000000080a1',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE a text; BEGIN
  FOREACH a IN ARRAY ARRAY['flag_update','b2b_link','b2b_unlink','event_create','event_update','event_delete',
    'promo_create','promo_update','promo_delete','challenge_create','challenge_update',
    'suggestion_approve','suggestion_reject','explore_create','explore_update','explore_delete',
    'explore_publish','explore_unpublish','report_kept','report_removed','report_warned','push_campaign','login_failed'] LOOP
    INSERT INTO public.admin_audit_log(spawt_staff_id,action,entity_type,reason)
      VALUES(auth.uid(),a,'session','transaction rolled back');
  END LOOP;
  BEGIN
    INSERT INTO public.admin_audit_log(spawt_staff_id,action,entity_type)
      VALUES(auth.uid(),'invented_action','session');
    RAISE EXCEPTION 'ASSERT: unknown audit action accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.admin_audit_log SET reason='rewritten' WHERE spawt_staff_id=auth.uid();
    IF FOUND THEN RAISE EXCEPTION 'ASSERT: audit history editable'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.spawt_staff SET is_active=false WHERE id='dddd0000-0000-4000-8000-0000000080a1';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.admin_audit_log(spawt_staff_id,action,entity_type) VALUES(auth.uid(),'flag_update','session');
    RAISE EXCEPTION 'ASSERT: inactive staff can write audit';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
