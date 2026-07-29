-- Confidentialité des avis publics (migration 0066).
--
-- Ce que ça protège : `spawt_checkin` porte la POSITION du spawter et
-- l'horodatage de son passage. La policy retirée en 0066 ouvrait ses 30
-- colonnes au rôle `anon` — celui de la clé publiée dans tous les binaires.
-- La RLS filtre des LIGNES, pas des COLONNES : c'est le piège.
--
-- Le trou était LATENT : aucun spawt en base ne portait de coordonnées (les 30
-- avis sont des avis fondateurs saisis à la main). Il se serait ouvert au
-- premier avis posté depuis Le Guet. Un audit qui regarde les données ne le
-- voit pas ; il faut regarder la policy.

\set ON_ERROR_STOP off

-- ── A. `anon` ne lit plus la table ─────────────────────────────────────────
SET ROLE anon;
DO $x$
BEGIN
  PERFORM count(*) FROM public.spawt_checkin;
  RAISE WARNING 'A ÉCHEC — anon lit encore spawt_checkin (position + horodatage)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'A OK — refus 42501';
END$x$;

-- ── B. `anon` lit bien les avis publics ────────────────────────────────────
SELECT 'B' AS scenario, count(*) > 0 AS lisible FROM public.public_reviews;
RESET ROLE;

-- ── C. La vue ne porte AUCUNE colonne de localisation ni de passage ────────
-- Assertion sur le SCHÉMA et non sur les données : une colonne ajoutée par
-- mégarde doit faire rougir ce test même si elle est vide partout.
SELECT 'C' AS scenario, string_agg(column_name, ', ') AS colonnes_interdites
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'public_reviews'
   AND (column_name LIKE '%geolocation%' OR column_name IN
        ('arrived_at','left_at','ip_address','device_id','check_in_type',
         'is_verified','antifraud_flags'));
-- attendu : NULL (aucune)

-- ── D. Aucune policy ne rouvre la table à `anon` ───────────────────────────
SELECT 'D' AS scenario, count(*) AS policies_anon
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'spawt_checkin'
   AND 'anon' = ANY(roles);
-- attendu : 0
