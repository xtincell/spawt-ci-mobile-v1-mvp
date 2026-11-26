import { z } from "zod";
import { isSupabaseConfigured } from "./data-source";
import { DataReadError, withReadTimeout } from "./data-read-error";

const webUrl = z.string().url().refine(url => /^https?:\/\//i.test(url));
const optionalUrl = webUrl.nullish().catch(null);
const source = z.object({
  label: z.string(), url: webUrl, checked_on: z.string(), fields: z.array(z.string()),
});
const practicalSchema = z.object({
  place_id: z.string(), website_url: optionalUrl, google_maps_url: optionalUrl,
  contact_email: z.string().email().nullish().catch(null),
  social_links: z.array(z.object({ label: z.string(), url: webUrl })),
  services: z.array(z.string()), payment_methods: z.array(z.string()),
  official_description: z.string().nullish(), sources: z.array(source),
});
const avg = z.number().min(1).max(5).nullable();
const statsSchema = z.object({
  place_id: z.string(), review_count: z.number().int().nonnegative(),
  cuisine_avg: avg, cadre_avg: avg, service_avg: avg,
  histogram: z.array(z.number().int().nonnegative()).length(5),
});
export type PlacePractical = z.infer<typeof practicalSchema>;
export type PlaceReviewStats = z.infer<typeof statsSchema>;

async function readPublicRow<S extends z.ZodType>(view: string, placeId: string, schema: S): Promise<z.infer<S> | null> {
  if (!isSupabaseConfigured) return null;
  const { supabase } = await import("./supabase");
  const { data, error } = await withReadTimeout(view, signal =>
    supabase.from(view).select("*").eq("place_id", placeId).abortSignal(signal).maybeSingle());
  if (error) throw new DataReadError(view);
  if (!data) return null;
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new DataReadError(view, "invalid_data");
  return parsed.data;
}
export const getPlacePractical = (id: string) => readPublicRow("public_place_practical", id, practicalSchema);
export const getPlaceReviewStats = (id: string) => readPublicRow("public_place_review_stats", id, statsSchema);
