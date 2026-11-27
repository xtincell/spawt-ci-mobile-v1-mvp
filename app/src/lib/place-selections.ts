import { z } from "zod";
import { isSupabaseConfigured } from "./data-source";
import { DataReadError, withReadTimeout } from "./data-read-error";

const selection = z.object({
  id: z.string(), slug: z.string().min(1), title_key: z.string().min(1),
  subtitle_key: z.string().nullable(), cover_url: z.string().url().nullable().catch(null),
});
export type PlaceSelection = z.infer<typeof selection>;

export async function getPlaceSelections(placeId: string): Promise<PlaceSelection[]> {
  if (!isSupabaseConfigured) return [];
  const { supabase } = await import("./supabase");
  const { data, error } = await withReadTimeout("place_selections", signal =>
    supabase.from("explore_collections")
      .select("id,slug,title_key,subtitle_key,cover_url,explore_items!inner(place_id)")
      .eq("is_published", true).eq("explore_items.place_id", placeId)
      .order("sort_order", { ascending: true }).abortSignal(signal));
  if (error) throw new DataReadError("place_selections");
  return (data ?? []).flatMap(row => {
    const parsed = selection.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
