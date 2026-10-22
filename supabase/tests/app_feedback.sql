\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('eeee0000-0000-4000-8000-0000000082a1','feedback-a@spawt.local'),
 ('eeee0000-0000-4000-8000-0000000082a2','feedback-b@spawt.local'),
 ('eeee0000-0000-4000-8000-0000000082a3','feedback-staff@spawt.local');
INSERT INTO spawters(id,phone_e164,display_name) VALUES
 ('eeee0000-0000-4000-8000-0000000082a1','+22577000821','Retour A'),
 ('eeee0000-0000-4000-8000-0000000082a2','+22577000822','Retour B');
INSERT INTO spawt_staff(id,email,display_name,role,is_active) VALUES
 ('eeee0000-0000-4000-8000-0000000082a3','feedback-staff@spawt.local','Équipe recette','operator',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_app_feedback('eeee0000-0000-4000-8000-0000000082ff','bug','Mon retour privé','app','{}');
    RAISE EXCEPTION 'ASSERT: anonymous submission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM app_feedback;
    RAISE EXCEPTION 'ASSERT: anonymous read';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000082a1',true);
SET LOCAL ROLE authenticated;
SELECT public.submit_app_feedback('eeee0000-0000-4000-8000-0000000082ff','bug','Mon retour privé','app','{"build":"37"}');
SELECT public.submit_app_feedback('eeee0000-0000-4000-8000-0000000082ff','bug','Mon retour privé','app','{"build":"37"}');
DO $$ BEGIN
  IF (SELECT count(*) FROM app_feedback)<>1 THEN RAISE EXCEPTION 'ASSERT: duplicate or missing receipt'; END IF;
  UPDATE app_feedback SET status='resolved';
  IF FOUND THEN RAISE EXCEPTION 'ASSERT: author can triage'; END IF;
  BEGIN
    INSERT INTO app_feedback(id,spawter_id,kind,message,context,status) VALUES(gen_random_uuid(),auth.uid(),'bug','Escalade interdite','app','resolved');
    RAISE EXCEPTION 'ASSERT: direct insert bypass';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000082a2',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM app_feedback) THEN RAISE EXCEPTION 'ASSERT: other account can read'; END IF;
  BEGIN
    PERFORM public.submit_app_feedback('eeee0000-0000-4000-8000-0000000082ff','bug','Mon retour privé','app','{}');
    RAISE EXCEPTION 'ASSERT: stolen id accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000082a3',true);
SET LOCAL ROLE authenticated;
UPDATE app_feedback SET status='reviewing',staff_reply='Merci, nous vérifions.' WHERE id='eeee0000-0000-4000-8000-0000000082ff';
DO $$ BEGIN
  BEGIN
    UPDATE app_feedback SET message='Texte réécrit';
    RAISE EXCEPTION 'ASSERT: staff rewrites original';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-0000000082a1',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM app_feedback WHERE status='reviewing' AND staff_reply='Merci, nous vérifions.') THEN RAISE EXCEPTION 'ASSERT: owner cannot read reply'; END IF;
  FOR i IN 1..9 LOOP PERFORM submit_app_feedback(gen_random_uuid(),'idea','Une idée de recette','app','{}'); END LOOP;
  BEGIN
    PERFORM submit_app_feedback(gen_random_uuid(),'idea','Une idée de trop','app','{}');
    RAISE EXCEPTION 'ASSERT: rate limit absent';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'feedback_rate_limit' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE spawters SET is_banned=true,banned_at=now(),banned_reason='Recette transactionnelle' WHERE id='eeee0000-0000-4000-8000-0000000082a1';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM submit_app_feedback(gen_random_uuid(),'bug','Compte suspendu','app','{}');
    RAISE EXCEPTION 'ASSERT: banned account accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
