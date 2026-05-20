// Story 6.2 — Upload de photos lieu via bucket place-photos sous chemin `places/<place_id>/`.

import { supabaseClient } from "../utility/supabaseClient";

export async function uploadPlacePhoto(placeId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `places/${placeId}/${Date.now()}.${ext}`;
  const { error } = await supabaseClient.storage
    .from("place-photos")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[storage] upload failed", error);
    return null;
  }
  const { data } = supabaseClient.storage.from("place-photos").getPublicUrl(path);
  return data.publicUrl;
}
