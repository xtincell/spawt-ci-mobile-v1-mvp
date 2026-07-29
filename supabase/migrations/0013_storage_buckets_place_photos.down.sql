-- Story 4.5 — Rollback bucket place-photos.

DROP POLICY IF EXISTS place_photos_update_own ON storage.objects;
DROP POLICY IF EXISTS place_photos_insert_own ON storage.objects;
DROP POLICY IF EXISTS place_photos_select_own ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'place-photos';
