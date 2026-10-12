-- Le bucket reste privé. Seules les photos d'avis affichables sont signables.
CREATE FUNCTION public.is_public_review_photo(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spawt_checkin sc JOIN public.places p ON p.id = sc.place_id
    WHERE p.is_published AND sc.note_etoiles IS NOT NULL AND sc.deleted_at IS NULL
      AND NOT sc.is_cancelled AND object_name = ANY(sc.photos)
      AND split_part(object_name, '/', 1) = sc.spawter_id::text
      AND split_part(object_name, '/', 2) = sc.id::text
  );
$$;
REVOKE ALL ON FUNCTION public.is_public_review_photo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_review_photo(text) TO anon, authenticated;
CREATE POLICY place_photos_select_published_review ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'place-photos' AND public.is_public_review_photo(name));
