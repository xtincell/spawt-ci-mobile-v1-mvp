-- ============================================================================
-- SPAWT — inventaire réel : Mission 1 Abidjan (8-13 mars 2026)
-- ============================================================================
-- Source : `SPAWT_Mission1_Abidjan_Rapport.docx` — 13 établissements visités,
-- 10 fiches complètes (scores /12, grilles tarifaires, notes B2B). Complété
-- par recherche web pour les téléphones et horaires publics.
--
-- Ce fichier REMPLACE les 12 lieux fictifs de `places.sql`. Ceux-là étaient un
-- décor : noms inventés, téléphones `+225XXXXXXX`, et surtout des compteurs
-- d'avis écrits en dur (28 à 156) sans une seule ligne d'avis derrière.
--
-- ── Comment l'ADN de départ a été dérivé ────────────────────────────────────
-- Le rapport note cinq dimensions sur 12 (Ambiance, Sociabilité, Cadence,
-- Budget, Notoriété) qui ne recouvrent pas les cinq axes du Palais. La
-- correspondance est donc explicite, place par place, plutôt que calculée par
-- une formule qu'on ne pourrait pas défendre :
--
--   axe_local_international  ← type de cuisine (ivoirienne ⇢ local)
--   axe_informel_etabli      ← maquis ⇢ informel, restaurant ⇢ établi
--   axe_budget_premium       ← milieu de la gamme « Moyen » de la grille
--   axe_populaire_prive      ← score Sociabilité (fort ⇢ populaire)
--   axe_decontracte_habille  ← Ambiance croisée au tier tarifaire
--
-- Ces valeurs sont un POINT DE DÉPART éditorial : la communauté les fait
-- ensuite bouger (migration 0025). Elles sont figées dans `base_axe_*`
-- (migration 0054) pour qu'un recompte sache d'où repartir.
--
-- ⚠️ COORDONNÉES — à vérifier sur le terrain avant d'activer Le Guet sur ces
-- lieux. Elles sont posées au niveau du quartier (précision ~200-400 m), ce
-- qui est suffisant pour le feed et la recherche, mais PAS pour un géofence de
-- 100 m. Le rapport de mission ne relève pas de GPS et les annuaires en ligne
-- n'en publient pas de fiable. Voir HUMAN_TODO.md.
-- Date : 2026-07-28

BEGIN;

-- ━━━ 1. Les lieux ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- UUID déterministes (v5-like, préfixe `a1`) pour que le seed soit rejouable
-- sans créer de doublons.
INSERT INTO public.places
  (id, name, cuisine, lat, lng, descriptive_address, neighborhood, city,
   price_tier, avg_ticket_xof, hours, phone, whatsapp, gallery_urls, signals,
   menu_urls, is_published, city_code)
VALUES
  -- PÉPITE — restaurant préféré de la mission, propriétaire très impliquée
  ('a1000000-0000-4000-8000-000000000001', 'Kaiten',
   ARRAY['asiatique'], 5.2962, -3.9948,
   'Rue du Docteur Blanchard, Zone 4', 'Zone 4', 'Abidjan',
   3, 16750,
   '{"mon":[{"open":"11:00","close":"15:00"},{"open":"18:30","close":"23:00"}],"tue":[{"open":"11:00","close":"15:00"},{"open":"18:30","close":"23:00"}],"wed":[{"open":"11:00","close":"15:00"},{"open":"18:30","close":"23:00"}],"thu":[{"open":"11:00","close":"15:00"},{"open":"18:30","close":"23:00"}],"fri":[{"open":"11:00","close":"15:00"},{"open":"18:30","close":"23:00"}],"sat":[{"open":"11:00","close":"15:00"},{"open":"18:30","close":"23:00"}],"sun":[{"open":"11:00","close":"15:00"},{"open":"18:30","close":"23:00"}]}'::jsonb,
   '+2252721254461', '+2250708317060', ARRAY[]::text[], ARRAY['sushi','business_lunch','lounge']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- PÉPITE — chaîne qui cherche activement du trafic, effet de levier B2B
  ('a1000000-0000-4000-8000-000000000002', 'Texas Grillz',
   ARRAY['grillades','burger_pizza'], 5.3558, -3.9876,
   'Riviera 2', 'Riviera 2', 'Abidjan',
   2, 12500,
   '{"mon":[{"open":"12:00","close":"23:30"}],"tue":[{"open":"12:00","close":"23:30"}],"wed":[{"open":"12:00","close":"23:30"}],"thu":[{"open":"12:00","close":"23:30"}],"fri":[{"open":"12:00","close":"23:30"}],"sat":[{"open":"12:00","close":"23:30"}],"sun":[{"open":"12:00","close":"23:30"}]}'::jsonb,
   '+2250777595947', '+2250777595947', ARRAY[]::text[], ARRAY['bbq','cocktails','groupes']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- COUP DE CŒUR — qualité exceptionnelle, vitrine idéale
  ('a1000000-0000-4000-8000-000000000003', 'Sam''s',
   ARRAY['burger_pizza','fusion'], 5.2988, -3.9992,
   'Zone 4', 'Zone 4', 'Abidjan',
   2, 11750,
   '{"mon":[{"open":"11:00","close":"23:00"}],"tue":[{"open":"11:00","close":"23:00"}],"wed":[{"open":"11:00","close":"23:00"}],"thu":[{"open":"11:00","close":"23:00"}],"fri":[{"open":"11:00","close":"23:00"}],"sat":[{"open":"11:00","close":"23:00"}],"sun":[{"open":"11:00","close":"23:00"}]}'::jsonb,
   NULL, NULL, ARRAY[]::text[], ARRAY['burgers','date','patisserie']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- COUP DE CŒUR — « meilleur porc de toute la vie », prix très accessibles
  ('a1000000-0000-4000-8000-000000000004', 'La Grande République',
   ARRAY['ivoirienne'], 5.3731, -3.9558,
   'Riviera Bonoumin — O''porco & O''sogo', 'Riviera Bonoumin', 'Abidjan',
   1, 9000,
   '{"mon":[{"open":"11:00","close":"23:00"}],"tue":[{"open":"11:00","close":"23:00"}],"wed":[{"open":"11:00","close":"23:00"}],"thu":[{"open":"11:00","close":"23:00"}],"fri":[{"open":"11:00","close":"00:00"}],"sat":[{"open":"11:00","close":"00:00"}],"sun":[{"open":"11:00","close":"23:00"}]}'::jsonb,
   NULL, NULL, ARRAY[]::text[], ARRAY['braise','porc','cour_exterieure','portions_genereuses']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- SOLIDE — galerie d'art, piano live, hôtel
  ('a1000000-0000-4000-8000-000000000005', 'Bushman Café',
   ARRAY['fusion','ouest_africaine'], 5.3689, -3.9641,
   'CIAD, Riviera 4 M''pouto', 'Riviera 4', 'Abidjan',
   2, 14000,
   '{"tue":[{"open":"16:00","close":"00:00"}],"wed":[{"open":"16:00","close":"00:00"}],"thu":[{"open":"16:00","close":"00:00"}],"fri":[{"open":"16:00","close":"00:00"}],"sat":[{"open":"16:00","close":"00:00"}],"sun":[{"open":"16:00","close":"00:00"}]}'::jsonb,
   '+2250759496651', NULL, ARRAY[]::text[], ARRAY['galerie_art','piano_live','jardin']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- SOLIDE — rooftop 600 m², plusieurs espaces
  ('a1000000-0000-4000-8000-000000000006', 'The Rooph',
   ARRAY['francaise','fusion'], 5.3736, -3.9571,
   'Immeuble Le Phare, Bonoumin — carrefour', 'Riviera Bonoumin', 'Abidjan',
   2, 14750,
   '{"mon":[{"open":"12:00","close":"00:00"}],"tue":[{"open":"12:00","close":"00:00"}],"wed":[{"open":"12:00","close":"00:00"}],"thu":[{"open":"12:00","close":"00:00"}],"fri":[{"open":"12:00","close":"02:00"}],"sat":[{"open":"12:00","close":"02:00"}],"sun":[{"open":"12:00","close":"00:00"}]}'::jsonb,
   '+2250707701010', '+2250707701010', ARRAY[]::text[], ARRAY['rooftop','terrasse','date','repas_pro']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- SOLIDE — bâtiment historique, cocktails remarquables
  ('a1000000-0000-4000-8000-000000000007', 'Madame Antika',
   ARRAY['ivoirienne','fusion'], 5.3477, -4.0012,
   'Danga, Cocody', 'Danga', 'Abidjan',
   1, 7000,
   '{"mon":[{"open":"11:00","close":"23:00"}],"tue":[{"open":"11:00","close":"23:00"}],"wed":[{"open":"11:00","close":"23:00"}],"thu":[{"open":"11:00","close":"23:00"}],"fri":[{"open":"11:00","close":"00:00"}],"sat":[{"open":"11:00","close":"00:00"}],"sun":[{"open":"11:00","close":"23:00"}]}'::jsonb,
   NULL, NULL, ARRAY[]::text[], ARRAY['cocktails','vue_coucher_soleil','decor_vintage','intimiste']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- MOYEN — espace lumineux, bar bien fourni
  ('a1000000-0000-4000-8000-000000000008', 'Kajazoma',
   ARRAY['fusion','asiatique','ouest_africaine'], 5.3762, -4.0093,
   'Boulevard Latrille, II Plateaux — Liehn & Co', 'II Plateaux', 'Abidjan',
   3, 17000,
   '{"mon":[{"open":"11:30","close":"23:00"}],"tue":[{"open":"11:30","close":"23:00"}],"wed":[{"open":"11:30","close":"23:00"}],"thu":[{"open":"11:30","close":"23:00"}],"fri":[{"open":"11:30","close":"00:00"}],"sat":[{"open":"11:30","close":"00:00"}],"sun":[{"open":"11:30","close":"23:00"}]}'::jsonb,
   NULL, NULL, ARRAY[]::text[], ARRAY['bar','groupes','lumineux']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- MOYEN — ancien bâtiment réaménagé, rhums arrangés maison
  ('a1000000-0000-4000-8000-000000000009', 'L''Impasse',
   ARRAY['ivoirienne'], 5.2955, -3.9981,
   'Zone 4, Marcory — ex-Ô Feu de Bois', 'Zone 4', 'Abidjan',
   1, 8250,
   '{"mon":[{"open":"11:00","close":"23:00"}],"tue":[{"open":"11:00","close":"23:00"}],"wed":[{"open":"11:00","close":"23:00"}],"thu":[{"open":"11:00","close":"23:00"}],"fri":[{"open":"11:00","close":"00:00"}],"sat":[{"open":"11:00","close":"00:00"}],"sun":[{"open":"11:00","close":"23:00"}]}'::jsonb,
   NULL, NULL, ARRAY[]::text[], ARRAY['brochettes','rhums_arranges','habitues','cadre_soigne']::text[], ARRAY[]::text[], true, 'abidjan'),

  -- MOYEN — boukarous cloisonnés, spécialité poisson et gibier
  ('a1000000-0000-4000-8000-000000000010', 'Le Paon',
   ARRAY['francaise','ivoirienne'], 5.3624, -3.9783,
   'Riviera 3', 'Riviera 3', 'Abidjan',
   3, 15500,
   '{"mon":[{"open":"11:30","close":"23:00"}],"tue":[{"open":"11:30","close":"23:00"}],"wed":[{"open":"11:30","close":"23:00"}],"thu":[{"open":"11:30","close":"23:00"}],"fri":[{"open":"11:30","close":"23:30"}],"sat":[{"open":"11:30","close":"23:30"}],"sun":[{"open":"11:30","close":"23:00"}]}'::jsonb,
   NULL, NULL, ARRAY[]::text[], ARRAY['poisson','gibier','boukarous','intimiste']::text[], ARRAY[]::text[], true, 'abidjan')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, cuisine = EXCLUDED.cuisine,
  lat = EXCLUDED.lat, lng = EXCLUDED.lng,
  descriptive_address = EXCLUDED.descriptive_address,
  neighborhood = EXCLUDED.neighborhood, city = EXCLUDED.city,
  price_tier = EXCLUDED.price_tier, avg_ticket_xof = EXCLUDED.avg_ticket_xof,
  hours = EXCLUDED.hours, phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp,
  signals = EXCLUDED.signals, is_published = EXCLUDED.is_published,
  city_code = EXCLUDED.city_code, updated_at = now();

-- ━━━ 2. L'ADN éditorial de départ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- On ne pose QUE les axes et leur base. Les compteurs (`total_reviews`,
-- `weighted_rating`, `confidence_score`) sont laissés à leur valeur par défaut
-- et calculés par le recompte (0054) depuis les avis réels — c'est
-- précisément ce qui manquait à `places.sql`, qui les écrivait à la main.
INSERT INTO public.place_adn AS a
  (place_id, axe_local_international, axe_informel_etabli, axe_budget_premium,
   axe_populaire_prive, axe_decontracte_habille,
   base_axe_local_international, base_axe_informel_etabli, base_axe_budget_premium,
   base_axe_populaire_prive, base_axe_decontracte_habille)
VALUES
  -- Kaiten : japonais, restaurant établi, premium, sociabilité faible (6/12
  -- → plutôt privé), ambiance 9/12 dans un registre habillé.
  ('a1000000-0000-4000-8000-000000000001',  0.90,  0.75,  0.65,  0.20,  0.60,
                                            0.90,  0.75,  0.65,  0.20,  0.60),
  -- Texas Grillz : BBQ format chaîne, milieu de gamme, très sociable (8/12).
  ('a1000000-0000-4000-8000-000000000002',  0.40,  0.30,  0.10, -0.30, -0.40,
                                            0.40,  0.30,  0.10, -0.30, -0.40),
  -- Sam's : fast-food fusion haut de gamme, service pro, ambiance date.
  ('a1000000-0000-4000-8000-000000000003',  0.55,  0.45,  0.05, -0.10,  0.10,
                                            0.55,  0.45,  0.05, -0.10,  0.10),
  -- La Grande République : maquis ivoirien, très populaire (9/12), accessible.
  ('a1000000-0000-4000-8000-000000000004', -0.90, -0.80, -0.55, -0.60, -0.70,
                                           -0.90, -0.80, -0.55, -0.60, -0.70),
  -- Bushman Café : fusion ouest-africaine, galerie/concerts, mi-établi.
  ('a1000000-0000-4000-8000-000000000005', -0.20,  0.35,  0.25, -0.10,  0.15,
                                           -0.20,  0.35,  0.25, -0.10,  0.15),
  -- The Rooph : rooftop français/fusion, très sociable (9/12), versatile.
  ('a1000000-0000-4000-8000-000000000006',  0.60,  0.55,  0.35, -0.40,  0.35,
                                            0.60,  0.55,  0.35, -0.40,  0.35),
  -- Madame Antika : ivoirien/afro-latino, espaces cloisonnés = poches d'intimité.
  ('a1000000-0000-4000-8000-000000000007', -0.35,  0.10, -0.40,  0.35,  0.05,
                                           -0.35,  0.10, -0.40,  0.35,  0.05),
  -- Kajazoma : fusion asiatique/africaine, premium, sociable (8/12).
  ('a1000000-0000-4000-8000-000000000008',  0.45,  0.50,  0.55, -0.30,  0.30,
                                            0.45,  0.50,  0.55, -0.30,  0.30),
  -- L'Impasse : maquis ivoiro-camerounais, habitués fidèles, accessible.
  ('a1000000-0000-4000-8000-000000000009', -0.75, -0.60, -0.45, -0.10, -0.50,
                                           -0.75, -0.60, -0.45, -0.10, -0.50),
  -- Le Paon : français/ivoirien, boukarous très intimistes (sociabilité 6/12).
  ('a1000000-0000-4000-8000-000000000010',  0.25,  0.40,  0.45,  0.45,  0.30,
                                            0.25,  0.40,  0.45,  0.45,  0.30)
ON CONFLICT (place_id) DO UPDATE SET
  axe_local_international = EXCLUDED.axe_local_international,
  axe_informel_etabli     = EXCLUDED.axe_informel_etabli,
  axe_budget_premium      = EXCLUDED.axe_budget_premium,
  axe_populaire_prive     = EXCLUDED.axe_populaire_prive,
  axe_decontracte_habille = EXCLUDED.axe_decontracte_habille,
  base_axe_local_international = EXCLUDED.base_axe_local_international,
  base_axe_informel_etabli     = EXCLUDED.base_axe_informel_etabli,
  base_axe_budget_premium      = EXCLUDED.base_axe_budget_premium,
  base_axe_populaire_prive     = EXCLUDED.base_axe_populaire_prive,
  base_axe_decontracte_habille = EXCLUDED.base_axe_decontracte_habille,
  updated_at = now()
-- Garde : si la communauté a déjà nourri l'ADN, on ne réécrase QUE la base
-- éditoriale, pas les axes appris. Sinon relancer ce seed effacerait le
-- travail des Spawters.
WHERE a.total_reviews = 0;

-- ━━━ 3. Retrait du décor ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Les 12 lieux de `places.sql` étaient fictifs (« Bô Zinc », « Garba Palace »…)
-- avec des téléphones `+225XXXXXXX`. Bushman Café y figurait aussi : il est
-- réel, et repris ci-dessus avec les données de la mission — son ancienne
-- ligne part avec les autres.
-- Sûr : aucun avis ne les référence (spawt_checkin est vide sur ces lieux) et
-- place_adn est en ON DELETE CASCADE.
DELETE FROM public.places
 WHERE id::text LIKE '00000000-0000-0000-0000-0000000000%'
   AND NOT EXISTS (SELECT 1 FROM public.spawt_checkin sc WHERE sc.place_id = places.id);

COMMIT;
