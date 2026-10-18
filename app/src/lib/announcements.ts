import { z } from "zod";
import { isSupabaseConfigured } from "./data-source";
import { getActiveCity } from "./city";

const schema = z.object({
  id: z.string().uuid(), title: z.string(), body: z.string(),
  kind: z.enum(["info", "news", "promo"]),
  deep_link: z.string().nullable(), starts_at: z.string(),
});
export type Announcement = z.infer<typeof schema>;

export async function listAnnouncements(id?: string): Promise<Announcement[]> {
  if (!isSupabaseConfigured) return [];
  const { supabase } = await import("./supabase");
  let query = supabase.from("public_announcements")
    .select("id,title,body,kind,deep_link,starts_at")
    .or(`city_code.is.null,city_code.eq.${getActiveCity().code}`)
    .order("starts_at", { ascending: false }).limit(100);
  if (id) query = query.eq("id", id);
  const { data, error } = await query.abortSignal(AbortSignal.timeout(10_000));
  if (error) throw error;
  return z.array(schema).parse(data ?? []);
}
