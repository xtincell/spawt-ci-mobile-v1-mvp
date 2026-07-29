-- Story 4.5 — Bucket Storage `place-photos` (avis photos) + RLS sub-folder.
-- Cohérence : `<spawter_id>/<spawt_id>/<index>.jpg` (architecture §Naming Patterns).
-- Bucket `place-covers` (read-only public, cover_photo_url Story 3.3a) reste différé Story 6.3.

INSERT INTO storage.buckets (id, name, public)
VALUES ('place-photos', 'place-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS sur storage.objects — bucket = 'place-photos'. SELECT/INSERT/UPDATE limités
-- au sous-dossier <auth.uid()>/. DELETE refusé publiquement (V1 immutable, modération
-- admin Story 6.4 via service_role).
CREATE POLICY place_photos_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY place_photos_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] IS NOT NULL
  );

CREATE POLICY place_photos_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'place-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
