// Story 4.5 — Upload photos d'avis vers bucket Storage `place-photos`.
// Path canonique : `<spawter_id>/<spawt_id>/<index>.jpg` (RLS sub-folder Story 4.5 migration 0013).
// Compression : expo-image-manipulator quality 0.8, resize maxWidth 1920px → cible < 1MB.

import { supabase } from "./supabase";

export function photoPath(
  spawter_id: string,
  spawt_id: string,
  index: 0 | 1 | 2,
): string {
  return `${spawter_id}/${spawt_id}/${index}.jpg`;
}

/**
 * Compresse une photo locale (uri file://...) via expo-image-manipulator.
 * Retourne l'URI locale post-compression, prête à uploader.
 * Si la lib est indisponible (mode test/web), retourne l'URI sans modif.
 */
export async function compressPhoto(uri: string): Promise<string> {
  try {
    const mod = await import("expo-image-manipulator");
    const ImageManipulator = mod.default ?? mod;
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat?.JPEG ?? "jpeg",
      },
    );
    return result.uri;
  } catch (err) {
    if (__DEV__) console.warn("[storage-photos] compressPhoto failed", err);
    return uri;
  }
}

/**
 * Upload une photo vers le bucket `place-photos`. Retourne le path Storage
 * si succès, null en échec (log __DEV__ warn, ne throw pas).
 */
export async function uploadReviewPhoto(
  uri: string,
  spawter_id: string,
  spawt_id: string,
  index: 0 | 1 | 2,
): Promise<string | null> {
  const path = photoPath(spawter_id, spawt_id, index);
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from("place-photos")
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (error) {
      if (__DEV__) console.warn("[storage-photos] uploadReviewPhoto failed", error);
      return null;
    }
    return path;
  } catch (err) {
    if (__DEV__) console.warn("[storage-photos] uploadReviewPhoto threw", err);
    return null;
  }
}

/** Génère une URL signée TTL 7 jours pour lecture (V1). */
export async function getReviewPhotoUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from("place-photos")
      .createSignedUrl(path, 7 * 24 * 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
