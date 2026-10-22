-- Do not silently discard moderation history, accepted photos or earned Paws.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.place_contributions) OR EXISTS(SELECT 1 FROM public.paws_ledger WHERE reason='contribution_validee')
  OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='place-contributions')
  OR EXISTS(SELECT 1 FROM public.place_contribution_rule_history) THEN
  RAISE EXCEPTION 'Contribution data exists: preserve it before reverting this schema'; END IF;
END $$;
DROP POLICY contribution_photo_public_read ON storage.objects;
DROP POLICY contribution_photo_private_read ON storage.objects;
DROP POLICY contribution_photo_insert ON storage.objects;
DROP FUNCTION public.is_public_contribution_photo(text);
DROP FUNCTION public.set_place_contribution_reward(text,integer,text);
DROP FUNCTION public.moderate_place_contribution(uuid,text,text,timestamptz,jsonb);
DROP FUNCTION public.submit_place_contribution(uuid,uuid,text,jsonb,text);
DROP TABLE public.place_contributions;
DROP FUNCTION public.remove_deleted_contribution_menus();
DROP TABLE public.place_contribution_rule_history;
DROP TABLE public.place_contribution_rules;
DELETE FROM storage.buckets WHERE id='place-contributions';
DROP INDEX public.paws_contribution_once;
ALTER TABLE public.paws_ledger DROP CONSTRAINT paws_ledger_reason_check;
ALTER TABLE public.paws_ledger ADD CONSTRAINT paws_ledger_reason_check CHECK(reason IN
 ('spawt_verifie','avis_publie','badge_obtenu','defi_collectif','ajustement_admin'));
