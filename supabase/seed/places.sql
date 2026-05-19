-- Seed 12 lieux SEED_PLACES (PRD §3.1 Feature 4 + cahier des charges §5.3).
-- Story 3.3a — UUIDs séquentiels stables (1-12) pour traçabilité dev. La prod
-- (Story 6.2/6.3 — Admin CRUD) utilisera gen_random_uuid() pour tout nouveau lieu.
--
-- Idempotent : ON CONFLICT DO NOTHING permet supabase db reset multiples.
-- Les UUIDs DOIVENT matcher app/src/data/seed/places.ts (test cohérence
-- client/serveur dans app/src/data/seed/__tests__/places-uuid.test.ts).

INSERT INTO places (
  id, name, cuisine, lat, lng, descriptive_address, neighborhood, city,
  price_tier, avg_ticket_xof, hours, phone, whatsapp, cover_photo_url,
  gallery_urls, signals, is_published, created_at, updated_at
) VALUES
  -- 1. Bô Zinc
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Bô Zinc',
   ARRAY['francaise','fusion'], 5.328, -4.009,
   'Zone 4, en face du centre commercial', 'Zone 4', 'Abidjan',
   3, 25000,
   '{"mon":[{"open":"12:00","close":"23:00"}],"tue":[{"open":"12:00","close":"23:00"}],"wed":[{"open":"12:00","close":"23:00"}],"thu":[{"open":"12:00","close":"23:00"}],"fri":[{"open":"12:00","close":"23:00"}],"sat":[{"open":"12:00","close":"23:00"}],"sun":[{"open":"12:00","close":"23:00"}]}'::jsonb,
   '+22527XXXXXXX', NULL, NULL, '{}', ARRAY['institution'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 2. Bushman Café
  ('00000000-0000-0000-0000-000000000002'::uuid, 'Bushman Café',
   ARRAY['fusion','ouest_africaine'], 5.358, -3.97,
   'Cocody Riviera Palmeraie', 'Cocody Riviera', 'Abidjan',
   2, 12000,
   '{"mon":[{"open":"11:00","close":"00:00"}],"tue":[{"open":"11:00","close":"00:00"}],"wed":[{"open":"11:00","close":"00:00"}],"thu":[{"open":"11:00","close":"00:00"}],"fri":[{"open":"11:00","close":"00:00"}],"sat":[{"open":"11:00","close":"00:00"}],"sun":[{"open":"11:00","close":"00:00"}]}'::jsonb,
   NULL, '+22507XXXXXXX', NULL, '{}', ARRAY['coup_de_coeur'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 3. Le Petit Paris
  ('00000000-0000-0000-0000-000000000003'::uuid, 'Le Petit Paris',
   ARRAY['francaise'], 5.325, -4.011,
   'Zone 4, près du Sofitel', 'Zone 4', 'Abidjan',
   3, 18000,
   '{"mon":[{"open":"12:00","close":"22:30"}],"tue":[{"open":"12:00","close":"22:30"}],"wed":[{"open":"12:00","close":"22:30"}],"thu":[{"open":"12:00","close":"22:30"}],"fri":[{"open":"12:00","close":"22:30"}],"sat":[{"open":"12:00","close":"22:30"}],"sun":[{"open":"12:00","close":"22:30"}]}'::jsonb,
   '+22527XXXXXXX', NULL, NULL, '{}', '{}', true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 4. Maquis Chez Tantie Rose
  ('00000000-0000-0000-0000-000000000004'::uuid, 'Maquis Chez Tantie Rose',
   ARRAY['ivoirienne'], 5.422, -4.024,
   'Abobo Baoulé, à côté de la pharmacie du marché', 'Abobo Baoulé', 'Abidjan',
   1, 1200,
   '{"mon":[{"open":"11:00","close":"22:00"}],"tue":[{"open":"11:00","close":"22:00"}],"wed":[{"open":"11:00","close":"22:00"}],"thu":[{"open":"11:00","close":"22:00"}],"fri":[{"open":"11:00","close":"22:00"}],"sat":[{"open":"11:00","close":"22:00"}],"sun":[{"open":"11:00","close":"22:00"}]}'::jsonb,
   NULL, NULL, NULL, '{}', ARRAY['pepite_verifiee'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 5. Chez Ambroise
  ('00000000-0000-0000-0000-000000000005'::uuid, 'Chez Ambroise',
   ARRAY['ivoirienne'], 5.347, -4.027,
   'Yopougon Selmer, premier maquis après le carrefour', 'Yopougon Selmer', 'Abidjan',
   1, 2000,
   '{"mon":[{"open":"12:00","close":"00:00"}],"tue":[{"open":"12:00","close":"00:00"}],"wed":[{"open":"12:00","close":"00:00"}],"thu":[{"open":"12:00","close":"00:00"}],"fri":[{"open":"12:00","close":"00:00"}],"sat":[{"open":"12:00","close":"00:00"}],"sun":[{"open":"12:00","close":"00:00"}]}'::jsonb,
   NULL, NULL, NULL, '{}', ARRAY['fidelite'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 6. Garba Palace
  ('00000000-0000-0000-0000-000000000006'::uuid, 'Garba Palace',
   ARRAY['ivoirienne'], 5.345, -4.029,
   'Yopougon Niangon, en face du lycée', 'Yopougon Niangon', 'Abidjan',
   1, 800,
   '{"mon":[{"open":"18:00","close":"02:00"}],"tue":[{"open":"18:00","close":"02:00"}],"wed":[{"open":"18:00","close":"02:00"}],"thu":[{"open":"18:00","close":"02:00"}],"fri":[{"open":"18:00","close":"02:00"}],"sat":[{"open":"18:00","close":"02:00"}],"sun":[{"open":"18:00","close":"02:00"}]}'::jsonb,
   NULL, NULL, NULL, '{}', ARRAY['noctambule_verifie'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 7. Norias
  ('00000000-0000-0000-0000-000000000007'::uuid, 'Norias',
   ARRAY['libanaise'], 5.351, -3.997,
   'Cocody II Plateaux, après la station Total', 'II Plateaux', 'Abidjan',
   2, 8000,
   '{"mon":[{"open":"11:00","close":"23:00"}],"tue":[{"open":"11:00","close":"23:00"}],"wed":[{"open":"11:00","close":"23:00"}],"thu":[{"open":"11:00","close":"23:00"}],"fri":[{"open":"11:00","close":"23:00"}],"sat":[{"open":"11:00","close":"23:00"}],"sun":[{"open":"11:00","close":"23:00"}]}'::jsonb,
   '+22527XXXXXXX', '+22507XXXXXXX', NULL, '{}', ARRAY['table_diverse'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 8. Sushi Lounge
  ('00000000-0000-0000-0000-000000000008'::uuid, 'Sushi Lounge',
   ARRAY['asiatique'], 5.331, -4.005,
   'Marcory Zone 4C, immeuble vitré', 'Zone 4C', 'Abidjan',
   3, 22000,
   '{"mon":[{"open":"12:00","close":"23:00"}],"tue":[{"open":"12:00","close":"23:00"}],"wed":[{"open":"12:00","close":"23:00"}],"thu":[{"open":"12:00","close":"23:00"}],"fri":[{"open":"12:00","close":"23:00"}],"sat":[{"open":"12:00","close":"23:00"}],"sun":[{"open":"12:00","close":"23:00"}]}'::jsonb,
   '+22527XXXXXXX', NULL, NULL, '{}', '{}', true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 9. Pizza Caprice
  ('00000000-0000-0000-0000-000000000009'::uuid, 'Pizza Caprice',
   ARRAY['italienne','burger_pizza'], 5.346, -3.985,
   'Riviera 3, au bout du boulevard', 'Riviera 3', 'Abidjan',
   2, 6500,
   '{"mon":[{"open":"11:30","close":"23:30"}],"tue":[{"open":"11:30","close":"23:30"}],"wed":[{"open":"11:30","close":"23:30"}],"thu":[{"open":"11:30","close":"23:30"}],"fri":[{"open":"11:30","close":"23:30"}],"sat":[{"open":"11:30","close":"23:30"}],"sun":[{"open":"11:30","close":"23:30"}]}'::jsonb,
   '+22527XXXXXXX', '+22507XXXXXXX', NULL, '{}', ARRAY['fidelite'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 10. Attieke Paradise
  ('00000000-0000-0000-0000-000000000010'::uuid, 'Attieke Paradise',
   ARRAY['ivoirienne'], 5.336, -3.994,
   'Marcory Anoumabo, près du grand marché', 'Marcory', 'Abidjan',
   1, 1500,
   '{"mon":[{"open":"10:00","close":"22:00"}],"tue":[{"open":"10:00","close":"22:00"}],"wed":[{"open":"10:00","close":"22:00"}],"thu":[{"open":"10:00","close":"22:00"}],"fri":[{"open":"10:00","close":"22:00"}],"sat":[{"open":"10:00","close":"22:00"}],"sun":[{"open":"10:00","close":"22:00"}]}'::jsonb,
   NULL, NULL, NULL, '{}', ARRAY['decouverte'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 11. Café des Arts
  ('00000000-0000-0000-0000-000000000011'::uuid, 'Café des Arts',
   ARRAY['cafe','patisserie'], 5.354, -3.992,
   'Cocody centre, en face du marché des fleurs', 'Cocody centre', 'Abidjan',
   2, 4500,
   '{"mon":[{"open":"07:00","close":"19:00"}],"tue":[{"open":"07:00","close":"19:00"}],"wed":[{"open":"07:00","close":"19:00"}],"thu":[{"open":"07:00","close":"19:00"}],"fri":[{"open":"07:00","close":"19:00"}],"sat":[{"open":"07:00","close":"19:00"}],"sun":[{"open":"07:00","close":"19:00"}]}'::jsonb,
   '+22527XXXXXXX', NULL, NULL, '{}', '{}', true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z'),
  -- 12. Assinie Beach Club
  ('00000000-0000-0000-0000-000000000012'::uuid, 'Assinie Beach Club',
   ARRAY['fusion','ouest_africaine'], 5.142, -3.435,
   'Assinie, accès plage privée', 'Assinie', 'Assinie-Mafia',
   3, 28000,
   '{"mon":[{"open":"10:00","close":"02:00"}],"tue":[{"open":"10:00","close":"02:00"}],"wed":[{"open":"10:00","close":"02:00"}],"thu":[{"open":"10:00","close":"02:00"}],"fri":[{"open":"10:00","close":"02:00"}],"sat":[{"open":"10:00","close":"02:00"}],"sun":[{"open":"10:00","close":"02:00"}]}'::jsonb,
   '+22527XXXXXXX', '+22507XXXXXXX', NULL, '{}', ARRAY['coup_de_coeur'], true,
   '2026-05-03T18:00:00Z', '2026-05-03T18:00:00Z')
-- `DO UPDATE` plutôt que `DO NOTHING` : si un dev modifie le nom / ADN
-- d'une seed row et relance `supabase db reset` (qui ré-applique le seed),
-- la nouvelle valeur doit refléter l'édition. Avec `DO NOTHING` l'édition
-- restait invisible jusqu'à un `DROP` manuel.
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  cuisine = EXCLUDED.cuisine,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  descriptive_address = EXCLUDED.descriptive_address,
  neighborhood = EXCLUDED.neighborhood,
  city = EXCLUDED.city,
  price_tier = EXCLUDED.price_tier,
  avg_ticket_xof = EXCLUDED.avg_ticket_xof,
  hours = EXCLUDED.hours,
  phone = EXCLUDED.phone,
  whatsapp = EXCLUDED.whatsapp,
  cover_photo_url = EXCLUDED.cover_photo_url,
  gallery_urls = EXCLUDED.gallery_urls,
  signals = EXCLUDED.signals,
  is_published = EXCLUDED.is_published;

INSERT INTO place_adn (
  place_id, axe_local_international, axe_informel_etabli, axe_budget_premium,
  axe_populaire_prive, axe_decontracte_habille, confidence_score, total_reviews,
  weighted_rating, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 0.6, 0.85, 0.7, -0.3, 0.6, 1.0, 87, 4.6, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 0.3, 0.4, 0.3, 0.2, 0.1, 1.0, 64, 4.4, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 0.7, 0.7, 0.55, -0.1, 0.5, 1.0, 52, 4.3, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000004'::uuid, -0.95, -0.85, -0.85, 0.4, -0.8, 1.0, 134, 4.8, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000005'::uuid, -0.9, -0.7, -0.7, -0.5, -0.7, 1.0, 98, 4.5, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000006'::uuid, -1.0, -0.95, -0.95, -0.6, -0.9, 1.0, 76, 4.4, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000007'::uuid, 0.5, 0.2, 0.0, -0.1, 0.0, 1.0, 89, 4.2, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000008'::uuid, 0.95, 0.7, 0.7, 0.0, 0.5, 0.9, 45, 4.0, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000009'::uuid, 0.6, 0.3, 0.1, -0.4, -0.3, 1.0, 112, 4.1, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000010'::uuid, -0.95, -0.6, -0.8, -0.3, -0.6, 0.56, 28, 4.3, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000011'::uuid, 0.4, 0.4, -0.1, 0.3, 0.0, 0.82, 41, 4.2, '2026-05-03T18:00:00Z'),
  ('00000000-0000-0000-0000-000000000012'::uuid, 0.4, 0.6, 0.85, 0.5, -0.2, 1.0, 156, 4.5, '2026-05-03T18:00:00Z')
ON CONFLICT (place_id) DO UPDATE SET
  axe_local_international = EXCLUDED.axe_local_international,
  axe_informel_etabli = EXCLUDED.axe_informel_etabli,
  axe_budget_premium = EXCLUDED.axe_budget_premium,
  axe_populaire_prive = EXCLUDED.axe_populaire_prive,
  axe_decontracte_habille = EXCLUDED.axe_decontracte_habille,
  confidence_score = EXCLUDED.confidence_score,
  total_reviews = EXCLUDED.total_reviews,
  weighted_rating = EXCLUDED.weighted_rating;
