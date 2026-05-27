// Story 6.2 — Upload de photos lieu via bucket place-photos sous chemin `places/<place_id>/`.
//
// CR Chunk B M10 — Validation MIME + size + extension from MIME pour bloquer :
//   - XSS via SVG servi comme image
//   - upload de fichiers exécutables / archives
//   - filename extension trustable (image.svg.png)
//   - taille excessive (50MB exe)

import { supabaseClient } from "../utility/supabaseClient";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadError =
  | { code: "INVALID_MIME"; received: string }
  | { code: "FILE_TOO_LARGE"; size: number; limit: number }
  | { code: "INVALID_PLACE_ID" }
  | { code: "UPLOAD_FAILED"; message: string };

export interface UploadResult {
  publicUrl?: string;
  error?: UploadError;
}

const PLACE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function uploadPlacePhoto(placeId: string, file: File): Promise<UploadResult> {
  // CR Chunk B M11 — bloque les uploads sur "draft-<timestamp>" en mode create.
  // Le caller doit attendre la création du place avant d'upload (sinon photo
  // orpheline + violation RLS storage [2]=valid place_id).
  if (!PLACE_ID_RE.test(placeId)) {
    return { error: { code: "INVALID_PLACE_ID" } };
  }
  const ext = ALLOWED_MIME_TO_EXT[file.type];
  if (!ext) {
    return { error: { code: "INVALID_MIME", received: file.type } };
  }
  if (file.size > MAX_BYTES) {
    return { error: { code: "FILE_TOO_LARGE", size: file.size, limit: MAX_BYTES } };
  }

  // Path canonique `places/<uuid>/<timestamp>.<ext-from-MIME>` — cohérent RLS
  // storage 0018 qui check foldername[1] = 'places' AND [2] = valid place_id.
  const path = `places/${placeId}/${Date.now()}.${ext}`;
  const { error } = await supabaseClient.storage
    .from("place-photos")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    return { error: { code: "UPLOAD_FAILED", message: error.message } };
  }
  const { data } = supabaseClient.storage.from("place-photos").getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}
