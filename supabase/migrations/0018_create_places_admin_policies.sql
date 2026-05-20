-- Story 6.2 — Policies staff CRUD sur places + place_adn + extension bucket place-photos.
-- Permet aux spawt_staff actifs d'opérer le panel admin sans service_role côté client.
-- Préservation : SELECT public reste contraint à is_published = true (Story 3.3a).
--
-- Soft-delete only sur `places` (`is_published = false`). Toute suppression physique
-- passe par service_role + Edge Function explicite (jamais V1). Préserve l'historique
-- `spawt_checkin.place_id`.

-- ━━━ places : staff CRUD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE POLICY places_select_staff ON places
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY places_insert_staff ON places
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY places_update_staff ON places
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Pas de policy DELETE : soft-delete via UPDATE is_published = false uniquement.

-- ━━━ place_adn : staff CRUD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE POLICY place_adn_select_staff ON place_adn
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY place_adn_insert_staff ON place_adn
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY place_adn_update_staff ON place_adn
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- ━━━ bucket place-photos : extension staff sous places/<place_id>/ ━━━━━━━━━

CREATE POLICY storage_place_photos_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = 'places'
    AND EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY storage_place_photos_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = 'places'
    AND EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

CREATE POLICY storage_place_photos_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = 'places'
    AND EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );
