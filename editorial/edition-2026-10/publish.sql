-- Édition originale SPAWT. À exécuter avec un rôle administrateur après 0075.
-- Transaction intégrale ; aucune création de lieu, aucun flag modifié.
-- Une réexécution identique est sans effet. Une édition déjà modifiée provoque un arrêt.
BEGIN;
DO $publish$
DECLARE c jsonb; i jsonb; cid uuid; existing public.explore_collections%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('spawt-editorial-october-2026'));
  FOR c IN SELECT value FROM jsonb_array_elements($payload$[{"slug": "premiers-pas-cote-ivoirien-octobre-2026", "title_key": "Premiers pas côté ivoirien", "subtitle_key": "Édition exploration · Deux premières pistes pour ouvrir son carnet ivoirien, une sortie à la fois. Couverture illustrée.", "cover_url": "https://raw.githubusercontent.com/xtincell/spawt-ci-mobile-v1-mvp/d78f4359e4c8853a5f83663ac6441c6b859c59d8/editorial/edition-2026-10/covers/premiers-pas.png", "audience": "general", "city_code": "abidjan", "sort_order": 10, "items": [{"place_id": "a1000000-0000-4000-8000-000000000004", "editorial_text": "Première piste : La Grande République, à Riviera Bonoumin. Sa fiche SPAWT indique une cuisine ivoirienne. Avant de partir, choisissez le plat que vous voulez découvrir et faites confirmer sa disponibilité.", "sort_order": 10}, {"place_id": "a1000000-0000-4000-8000-000000000010", "editorial_text": "Le Paon, à Riviera 3, réunit les catégories française et ivoirienne dans SPAWT. Une piste pour comparer vos envies et demander quelles spécialités ivoiriennes sont proposées le jour de votre passage.", "sort_order": 30}]}, {"slug": "zone-4-trois-pistes-octobre-2026", "title_key": "Zone 4 · Trois pistes à goûter", "subtitle_key": "Édition exploration · Trois adresses, trois envies à comparer en Zone 4. Couverture illustrée ; pas un itinéraire.", "cover_url": "https://raw.githubusercontent.com/xtincell/spawt-ci-mobile-v1-mvp/d78f4359e4c8853a5f83663ac6441c6b859c59d8/editorial/edition-2026-10/covers/zone-quatre.png", "audience": "general", "city_code": "abidjan", "sort_order": 20, "items": [{"place_id": "a1000000-0000-4000-8000-000000000001", "editorial_text": "Piste japonaise : Kaiten, rue du Dr Blanchard. Son menu en ligne propose sushi, sashimi et gyozas. Le déjeuner est affiché à 20 000 ou 22 000 FCFA selon la formule : vérifiez la carte avant de choisir.", "sort_order": 10}, {"place_id": "a1000000-0000-4000-8000-000000000003", "editorial_text": "Piste burgers : Sam’s. Sa fiche SPAWT le situe en Zone 4 et le classe en burger/pizza et fusion. Votre mission : repérer une proposition qui vous intrigue et vérifier son prix avant de vous déplacer.", "sort_order": 20}, {"place_id": "a1000000-0000-4000-8000-000000000009", "editorial_text": "Piste camerounaise : L’Impasse, ex-Ô Feu de Bois. Tripinafrica y signale ndolé et poulet DG. Demandez la carte du jour avant de choisir, puis gardez votre découverte pour la prochaine sortie de la Bande.", "sort_order": 30}]}, {"slug": "a-deux-hors-habitudes-octobre-2026", "title_key": "À deux · On sort des habitudes", "subtitle_key": "Édition exploration · Deux pistes, une décision à deux : comparer les envies et le budget avant de réserver. Couverture illustrée.", "cover_url": "https://raw.githubusercontent.com/xtincell/spawt-ci-mobile-v1-mvp/d78f4359e4c8853a5f83663ac6441c6b859c59d8/editorial/edition-2026-10/covers/duo.png", "audience": "duo", "city_code": "abidjan", "sort_order": 10, "items": [{"place_id": "a1000000-0000-4000-8000-000000000001", "editorial_text": "À deux chez Kaiten : le menu affiche des gyozas par six à 9 000 FCFA dans les apéritifs à partager. Choisissez ensemble la suite du repas et votre budget total. Une piste de partage, sans promesse d’ambiance romantique.", "sort_order": 10}, {"place_id": "a1000000-0000-4000-8000-000000000007", "editorial_text": "Madame Antika pour une découverte à deux : l’établissement se présente comme afro-latino. Chacun choisit une saveur qu’il veut explorer ; comparez vos envies avant de réserver. Menu, budget et disponibilité restent à confirmer.", "sort_order": 20}]}]$payload$::jsonb) LOOP
    FOR i IN SELECT value FROM jsonb_array_elements(c->'items') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.places WHERE id=(i->>'place_id')::uuid AND is_published) THEN
        RAISE EXCEPTION 'Lieu absent ou non publié : %', i->>'place_id';
      END IF;
    END LOOP;
    SELECT * INTO existing FROM public.explore_collections WHERE slug=c->>'slug' FOR UPDATE;
    IF FOUND THEN
      IF existing.title_key IS DISTINCT FROM c->>'title_key'
        OR existing.subtitle_key IS DISTINCT FROM c->>'subtitle_key'
        OR existing.cover_url IS DISTINCT FROM c->>'cover_url'
        OR existing.audience IS DISTINCT FROM c->>'audience'
        OR existing.city_code IS DISTINCT FROM c->>'city_code'
        OR existing.sort_order IS DISTINCT FROM (c->>'sort_order')::integer
        OR existing.is_published IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Édition déjà modifiée : %. Relire dans admin, pas d’écrasement.',c->>'slug';
      END IF;
      cid:=existing.id;
    ELSE
      INSERT INTO public.explore_collections(slug,title_key,subtitle_key,cover_url,audience,city_code,sort_order,is_published)
      VALUES(c->>'slug',c->>'title_key',c->>'subtitle_key',c->>'cover_url',c->>'audience',c->>'city_code',(c->>'sort_order')::integer,true) RETURNING id INTO cid;
    END IF;
    FOR i IN SELECT value FROM jsonb_array_elements(c->'items') LOOP
      IF EXISTS (SELECT 1 FROM public.explore_items WHERE collection_id=cid AND place_id=(i->>'place_id')::uuid
        AND (editorial_text IS DISTINCT FROM i->>'editorial_text' OR sort_order IS DISTINCT FROM (i->>'sort_order')::integer)) THEN
        RAISE EXCEPTION 'Texte éditorial modifié : %, %', c->>'slug',i->>'place_id';
      END IF;
      INSERT INTO public.explore_items(collection_id,place_id,editorial_text,sort_order)
      VALUES(cid,(i->>'place_id')::uuid,i->>'editorial_text',(i->>'sort_order')::integer)
      ON CONFLICT(collection_id,place_id) DO NOTHING;
    END LOOP;
    IF (SELECT count(*) FROM public.explore_items WHERE collection_id=cid) <> jsonb_array_length(c->'items') THEN
      RAISE EXCEPTION 'Contenu de carnet différent : %',c->>'slug';
    END IF;
  END LOOP;
END $publish$;
COMMIT;
