-- R27 (build 8) — Bucket Storage `avatars` (photo de profil spawter).
-- Path canonique : `<spawter_id>/avatar.jpg` (upsert — 1 avatar par spawter).
-- Bucket PUBLIC en lecture : `spawters.avatar_url` stocke l'URL publique,
-- consommée telle quelle par l'app (ReviewCard, fil Meute via spawters_public)
-- sans signed URL à rafraîchir. Écriture : RLS sous-dossier owner-only,
-- même modèle que `place-photos` (migration 0013).

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture : publique (bucket public) — policy SELECT explicite pour les accès
-- API authentifiés (list/download via SDK).
CREATE POLICY avatars_select_all ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Remplacement d'avatar : l'upload utilise `upsert` (UPDATE) ; DELETE autorisé
-- sur son propre sous-dossier pour permettre un éventuel retrait de photo.
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
