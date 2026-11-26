-- Confirmed on the venue's /brunch-menu/ and /eat-menu/ pages on 2026-11-26.
-- Append to the editorial draft; publication of the full profile uses its usual rules.
BEGIN;
DO $add_tip$
DECLARE
  target constant uuid := 'c5acfd12-01dd-5cd3-9beb-0531d89c3e99';
  title constant text := 'Quel prix pour un burger au brunch ?';
  answer constant text := 'Les burgers de poulet et de veau sont à 12 000 F CFA chacun au brunch. À la carte, ils sont à 15 000 F CFA chacun. — Rédaction SPAWT, cartes du IN’ consultées le 26 novembre 2026.';
  editorial jsonb;
  sections jsonb;
  snapshots public.place_practical_profiles;
  updated_draft jsonb;
  updated_live jsonb;
  field_name text;
  source_doc jsonb;
  menu record;
  position integer;
  current_label text;
BEGIN
  PERFORM FROM public.places WHERE id=target AND city_code='abidjan' AND name='IN’ Concept Store' AND is_published FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unrecognized place'; END IF;
  SELECT document INTO editorial FROM public.place_editorial_profiles WHERE place_id=target FOR UPDATE;
  sections := COALESCE(editorial->'sections','[]'::jsonb);
  IF EXISTS (SELECT FROM jsonb_array_elements(sections) AS section WHERE section->>'title'=title AND section->>'body' IS DISTINCT FROM answer) THEN
    RAISE EXCEPTION 'Existing editorial answer requires manual review';
  END IF;
  IF NOT EXISTS (SELECT FROM jsonb_array_elements(sections) AS section WHERE section->>'title'=title) THEN
    IF jsonb_array_length(sections)>=12 THEN RAISE EXCEPTION 'Editorial profile has reached its section limit'; END IF;
    editorial := jsonb_set(COALESCE(editorial,'{}'::jsonb),'{sections}',sections || jsonb_build_array(jsonb_build_object('title',title,'body',answer)));
    INSERT INTO public.place_editorial_profiles(place_id,document) VALUES(target,editorial)
    ON CONFLICT(place_id) DO UPDATE SET document=EXCLUDED.document,revision=place_editorial_profiles.revision+1,updated_at=now(),updated_by=NULL;
  END IF;
  SELECT * INTO STRICT snapshots FROM public.place_practical_profiles WHERE place_id=target FOR UPDATE;
  FOREACH field_name IN ARRAY ARRAY['draft','published_document'] LOOP
    source_doc := CASE field_name WHEN 'draft' THEN snapshots.draft ELSE snapshots.published_document END;
    FOR menu IN SELECT * FROM (VALUES
      ('https://www.inconceptstore.com/brunch-menu/','Brunch du IN’','Brunch · burgers de poulet et de veau à 12 000 F CFA chacun'),
      ('https://www.inconceptstore.com/eat-menu/','Carte du restaurant','À la carte · burgers de poulet et de veau à 15 000 F CFA chacun')
    ) AS m(url,old_label,new_label) LOOP
      SELECT ordinality::integer-1, entry->>'label' INTO STRICT position,current_label
        FROM jsonb_array_elements(source_doc->'sources') WITH ORDINALITY s(entry,ordinality)
        WHERE entry->>'url'=menu.url AND entry->>'checked_on'='2026-11-26';
      IF current_label NOT IN (menu.old_label,menu.new_label) THEN RAISE EXCEPTION 'Existing source label requires editorial review'; END IF;
      source_doc := jsonb_set(source_doc,ARRAY['sources',position::text,'label'],to_jsonb(menu.new_label));
    END LOOP;
    PERFORM public.check_practical_document(source_doc,field_name='published_document');
    IF field_name='draft' THEN updated_draft:=source_doc; ELSE updated_live:=source_doc; END IF;
  END LOOP;
  IF snapshots.draft IS DISTINCT FROM updated_draft OR snapshots.published_document IS DISTINCT FROM updated_live THEN
    UPDATE public.place_practical_profiles SET draft=updated_draft,published_document=updated_live,revision=revision+1,updated_at=now() WHERE place_id=target;
  END IF;
END $add_tip$;
COMMIT;

