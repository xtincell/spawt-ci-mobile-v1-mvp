// R27 (build 8) — Upload de la photo de profil vers le bucket Storage
// `avatars` (migration 0031). Path canonique : `<spawter_id>/avatar.jpg`
// (upsert — 1 avatar par spawter). Le bucket est PUBLIC en lecture :
// on stocke l'URL publique dans `spawters.avatar_url`, consommée telle
// quelle partout (ReviewCard, fil Meute). Compression : resize 512px,
// quality 0.8 (un avatar rond de 80 px n'a pas besoin de plus).

import { supabase } from "./supabase";

/** Largeur cible de l'avatar compressé (px). */
const AVATAR_MAX_WIDTH = 512;

export function avatarPath(spawter_id: string): string {
  return `${spawter_id}/avatar.jpg`;
}

/**
 * Compresse la photo locale (uri file://…) via expo-image-manipulator.
 * Retourne l'URI post-compression ; l'URI d'origine si la lib manque
 * (web/test) — même pattern fail-soft que `compressPhoto` (storage-photos).
 */
export async function compressAvatar(uri: string): Promise<string> {
  try {
    const mod = await import("expo-image-manipulator");
    const ImageManipulator = mod.default ?? mod;
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: AVATAR_MAX_WIDTH } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat?.JPEG ?? "jpeg",
      },
    );
    return result.uri;
  } catch (err) {
    if (__DEV__) console.warn("[storage-avatars] compressAvatar failed", err);
    return uri;
  }
}

/**
 * Upload l'avatar (déjà compressé) vers `avatars/<spawter_id>/avatar.jpg`.
 * Retourne l'URL PUBLIQUE cache-bustée (`?v=<ts>` — le path est stable en
 * upsert, sans le paramètre l'ancien avatar resterait affiché depuis le
 * cache Image). `null` en échec (log __DEV__, ne throw pas).
 */
export async function uploadAvatar(
  uri: string,
  spawter_id: string,
): Promise<string | null> {
  const path = avatarPath(spawter_id);
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from("avatars").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) {
      if (__DEV__) console.warn("[storage-avatars] uploadAvatar failed", error);
      return null;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    if (!data?.publicUrl) return null;
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (err) {
    if (__DEV__) console.warn("[storage-avatars] uploadAvatar threw", err);
    return null;
  }
}
