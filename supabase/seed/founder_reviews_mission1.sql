-- ============================================================================
-- SPAWT — avis fondateurs Mission 1 (FR-032)
-- ============================================================================
-- Le cahier prévoit explicitement 3 avis fondateurs par lieu, pour la raison
-- posée au §5.4 du cahier Sprint 1 : sans eux, 100 % des fiches afficheraient
-- « ADN en construction » au lancement, et la valeur du produit resterait
-- invisible. Stéphanie le formulait ainsi — « on ment au user en lui montrant
-- une promesse non tenue ».
--
-- ── Ce qui rend ces avis honnêtes ───────────────────────────────────────────
-- 1. Leur CONTENU n'est pas inventé : il vient des observations de terrain du
--    rapport Mission 1 (points forts, points faibles, plats testés). Ce sont
--    de vraies impressions, sur de vraies visites, avec de vrais budgets.
-- 2. Ils sont MARQUÉS `is_seed = true` et rattachés à un LOT identifiable —
--    donc retirables en une commande le jour où les abonnés arrivent :
--       SELECT purge_seed_reviews('a1000000-0000-4000-8000-00000000f001');
-- 3. Ils N'ENTRENT PAS dans le compteur public d'avis (0025 + 0054) et l'app
--    les badge « ✨ Avis fondateur ». Personne ne peut les prendre pour des
--    avis de la communauté.
-- 4. Ils sont portés par un COMPTE DE SERVICE (`spawters.is_seed = true`), pas
--    par un vrai abonné — sans quoi le nom d'un Spawter réel s'afficherait
--    sous un texte qu'il n'a pas écrit.
--
-- Les notes reprennent la note globale du rapport (/5). Les tags reprennent
-- les signaux réellement observés.
-- Date : 2026-07-28

BEGIN;

-- ━━━ 1. Le compte de service qui porte les avis fondateurs ━━━━━━━━━━━━━━━━━
-- Pas de ligne auth.users : ce compte ne se connecte jamais. La FK
-- spawters.id → auth.users(id) impose toutefois une ligne, créée ici avec un
-- e-mail interne non routable.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        created_at, updated_at, email_confirmed_at)
VALUES ('a1000000-0000-4000-8000-00000000e001',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'mission1@seed.spawt.local', '', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.spawters (id, phone_e164, display_name, stade, is_seed, neighborhood)
VALUES ('a1000000-0000-4000-8000-00000000e001', '+22500000001',
        'Mission 1 — reconnaissance terrain', 'guide', true, 'Abidjan')
ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name, is_seed = true, stade = 'guide';

-- ━━━ 2. Les avis ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- `arrived_at` = la vraie date de visite du rapport. `check_in_type = manual`
-- et `geolocation_source = manual` : ces spawts n'ont pas été géolocalisés,
-- ne pas prétendre le contraire. `is_verified = false` pour la même raison.
INSERT INTO public.spawt_checkin
  (spawter_id, place_id, arrived_at, check_in_type, geolocation_source,
   is_verified, note_etoiles, texte_avis, tags, is_seed, seed_batch_id)
VALUES
  -- ── Kaiten (5/5, PÉPITE, visite du 10/03) ────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000001',
   '2026-03-10 12:30:00+00', 'manual', 'manual', false, 5,
   'Le doyen du japonais à Abidjan, et ça se sent. Sushi et carpaccio au niveau. Le menu lunch du midi est le meilleur rapport de la ville.',
   ARRAY['a_refaire']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000001',
   '2026-03-10 20:00:00+00', 'manual', 'manual', false, 5,
   'Lounge cigares, carte de whiskies japonais et de champagnes. On y vient pour l''occasion, pas pour dépanner.',
   ARRAY['ambiance_top','cher']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000001',
   '2026-03-11 13:00:00+00', 'manual', 'manual', false, 4,
   'La carte grimpe vite le soir. À midi en revanche, l''entrée-plat à 18 000 est une affaire.',
   ARRAY['cher']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── Texas Grillz (4/5, PÉPITE, 10/03) ────────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000002',
   '2026-03-10 19:00:00+00', 'manual', 'manual', false, 4,
   'Les ribs tiennent leurs promesses et le bartender fait des cocktails sur mesure. Cosy malgré le format chaîne.',
   ARRAY['copieux','ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000002',
   '2026-03-10 19:30:00+00', 'manual', 'manual', false, 4,
   'Cuisine isolée, volume bas : on s''entend parler. Rare pour du BBQ.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000002',
   '2026-03-10 20:30:00+00', 'manual', 'manual', false, 3,
   'Huit tables seulement. Venir tôt, ou prévoir d''attendre.',
   ARRAY[]::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── Sam's (5/5, COUP DE CŒUR, 09/03) ─────────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000003',
   '2026-03-09 13:00:00+00', 'manual', 'manual', false, 5,
   'Le Crispy Bomb vaut son prix. Service carré, carte mise à jour régulièrement, propreté irréprochable.',
   ARRAY['copieux','a_refaire']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000003',
   '2026-03-09 13:30:00+00', 'manual', 'manual', false, 5,
   'Le carrot cake n''est pas un bonus, c''est une raison de venir.',
   ARRAY['a_refaire']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000003',
   '2026-03-09 14:00:00+00', 'manual', 'manual', false, 4,
   'Ambiance plutôt date et couples. Pour une bande de dix, chercher ailleurs.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── La Grande République (5/5, COUP DE CŒUR, 11/03) ──────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000004',
   '2026-03-11 19:00:00+00', 'manual', 'manual', false, 5,
   'Le meilleur porc goûté de toute la mission, sans hésiter. Les travers à 6 500, c''est cadeau.',
   ARRAY['copieux','a_refaire']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000004',
   '2026-03-11 19:30:00+00', 'manual', 'manual', false, 5,
   'Pieds dans le sable, grande cour esprit plage, plafond très haut. On reste plus longtemps que prévu.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000004',
   '2026-03-11 20:00:00+00', 'manual', 'manual', false, 5,
   'Portions généreuses, prix très accessibles. Le rapport qualité-prix de la mission.',
   ARRAY['copieux']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── Bushman Café (4/5, SOLIDE, 08/03) ────────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000005',
   '2026-03-08 19:00:00+00', 'manual', 'manual', false, 4,
   'Piano live le soir, statues et déco galerie sur plusieurs niveaux. On mange dans une exposition.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000005',
   '2026-03-08 19:45:00+00', 'manual', 'manual', false, 4,
   'Le Poulet Sahel tient la route et l''alloco était offert. Toilettes très soignées — ça compte.',
   ARRAY['copieux']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000005',
   '2026-03-08 21:00:00+00', 'manual', 'manual', false, 3,
   'En extérieur le soir, les moustiques s''invitent. Prévoir de quoi tenir.',
   ARRAY[]::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── The Rooph (4/5, SOLIDE, 09/03) ───────────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000006',
   '2026-03-09 20:00:00+00', 'manual', 'manual', false, 5,
   'Souris d''agneau confite, cuisson parfaite. Le pain perdu fumé glace cajou derrière : rien à jeter.',
   ARRAY['a_refaire']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000006',
   '2026-03-09 20:30:00+00', 'manual', 'manual', false, 4,
   'Terrasse, intérieur feutré climatisé, espace reculé : ça marche pour un date, un repas pro ou entre potes.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000006',
   '2026-03-09 21:00:00+00', 'manual', 'manual', false, 3,
   'La signalétique en bas de l''immeuble est quasi inexistante. Prévoir de tourner un peu.',
   ARRAY[]::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── Madame Antika (4/5, SOLIDE, 09/03) ───────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000007',
   '2026-03-09 17:30:00+00', 'manual', 'manual', false, 5,
   'Le meilleur cocktail du séjour — folléré-bissap. À lui seul il justifie le détour.',
   ARRAY['a_refaire']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000007',
   '2026-03-09 18:00:00+00', 'manual', 'manual', false, 4,
   'Bâtiment historique, cartes postales vintage de Grand-Bassam, masques en bois. La vue au coucher du soleil est remarquable.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000007',
   '2026-03-09 18:30:00+00', 'manual', 'manual', false, 4,
   'Espaces cloisonnés, vraies poches d''intimité. En revanche, au-delà de douze, ça ne passe pas.',
   ARRAY[]::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── Kajazoma (3/5, MOYEN, 09/03) ─────────────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000008',
   '2026-03-09 12:30:00+00', 'manual', 'manual', false, 4,
   'Espace ouvert et lumineux mais cosy. Grands fauteuils pour les groupes, tables de deux ou quatre à côté.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000008',
   '2026-03-09 13:00:00+00', 'manual', 'manual', false, 3,
   'Le fritto misto soupions-crevettes est correct sans plus. Le bar, lui, est bien fourni.',
   ARRAY[]::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000008',
   '2026-03-09 13:45:00+00', 'manual', 'manual', false, 2,
   'Service plus long que prévu, et pas de carte physique — on te renvoie vers un QR code.',
   ARRAY[]::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── L'Impasse (3/5, MOYEN, 10/03) ────────────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000009',
   '2026-03-10 21:00:00+00', 'manual', 'manual', false, 4,
   'Très beau cadre, ancien bâtiment réaménagé avec goût. Les rhums arrangés maison valent le coup.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000009',
   '2026-03-10 21:30:00+00', 'manual', 'manual', false, 3,
   'Brochettes de porc un peu sèches — la viande est précuite, on ne te le dit pas.',
   ARRAY[]::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000009',
   '2026-03-10 22:00:00+00', 'manual', 'manual', false, 4,
   'Les habitués sont fidèles et satisfaits. Desserts maison. Prix doux.',
   ARRAY['rapide']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),

  -- ── Le Paon (3/5, MOYEN, 11/03) ──────────────────────────────────────────
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000010',
   '2026-03-11 12:30:00+00', 'manual', 'manual', false, 4,
   'Les boukarous cloisonnés sont très intimistes. Carte large : poisson, gibier — agouti, hérisson — et volailles.',
   ARRAY['ambiance_top']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000010',
   '2026-03-11 13:15:00+00', 'manual', 'manual', false, 3,
   'La carpe braisée aux épices est bonne, mais 17 000 avec le supplément frites, ça pique.',
   ARRAY['cher']::text[], true, 'a1000000-0000-4000-8000-00000000f001'),
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-000000000010',
   '2026-03-11 14:00:00+00', 'manual', 'manual', false, 2,
   'Service lent — la rôtisserie poisson prend son temps. À savoir avant de s''installer.',
   ARRAY[]::text[], true, 'a1000000-0000-4000-8000-00000000f001')
ON CONFLICT DO NOTHING;

COMMIT;

-- Recompte final : les axes de l'ADN intègrent les signaux de ces avis, mais
-- `total_reviews` reste à 0 — les avis fondateurs ne gonflent pas le compteur
-- public. C'est exactement ce que FR-032 demande.
SELECT public.recompute_place_adn_full(place_id) FROM public.place_adn;
