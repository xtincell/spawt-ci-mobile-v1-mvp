import { supabase } from "./supabase";
import { resolveReviewPhotoUrls } from "./storage-photos";
import {
  communityPage,
  type CommunityQuery,
  type CommunityPage,
} from "./community";
import type { MeuteActivityItem } from "./data-source";

/** Uses public projections only: embedding `spawters!inner` loses other people's activity to owner RLS. */
export async function listCommunityPageFromSupabase({
  filter = "all",
  cursor,
  limit = 20,
}: CommunityQuery = {}): Promise<CommunityPage> {
  const size = Math.min(50, Math.max(1, Math.trunc(limit) || 20));
  // Cursor is local state, but still validate before inserting it in PostgREST syntax.
  if (
    cursor &&
    (!/^[0-9a-f-]{36}$/i.test(cursor.id) ||
      !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(
        cursor.created_at
      ))
  ) {
    throw new Error("Invalid community cursor");
  }
  const selectPlace = "places!inner(name, neighborhood, cover_photo_url)";
  async function read(kind: "review" | "coup") {
    if (filter !== "all" && filter !== kind) return [];
    let query =
      kind === "review"
        ? supabase
            .from("public_reviews")
            .select(
              `id, created_at, spawter_id, note_etoiles, note_globale, note_cuisine, note_cadre, note_service, texte_avis, photos, place_id, display_name, avatar_url, ${selectPlace}`
            )
            .eq("is_seed", false)
        : supabase
            .from("coups_de_coeur")
            .select(`id, created_at, spawter_id, place_id, ${selectPlace}`);
    // The places RLS is wider for staff. Apply publication explicitly to every audience.
    query = query.eq("places.is_published", true);
    if (cursor)
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      );
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(size + 1);
    if (error) throw error;
    return (data ?? []) as unknown as Record<string, unknown>[];
  }
  const [reviews, coups] = await Promise.all([read("review"), read("coup")]);
  // Lookup the safe public projection in one batch; never request private profile columns.
  const profiles = new Map<string, Record<string, unknown>>();
  if (coups.length) {
    const { data, error } = await supabase
      .from("spawters_public")
      .select("id, display_name, avatar_url")
      .in("id", [...new Set(coups.map((row) => String(row.spawter_id)))]);
    if (error) throw error;
    for (const profile of data ?? []) profiles.set(profile.id, profile);
  }
  const items: MeuteActivityItem[] = [];
  for (const [kind, rows] of [
    ["review", reviews],
    ["coup", coups],
  ] as const) {
    for (const row of rows) {
      const place = (
        Array.isArray(row.places) ? row.places[0] : row.places
      ) as Record<string, unknown> | null;
      const author =
        kind === "review" ? row : profiles.get(String(row.spawter_id));
      if (!place || !author) continue;
      items.push({
        kind,
        id: String(row.id),
        created_at: String(row.created_at),
        spawter_id: String(row.spawter_id),
        spawter_display_name: String(author.display_name ?? "Spawter"),
        spawter_avatar_url:
          typeof author.avatar_url === "string" ? author.avatar_url : null,
        place_id: String(row.place_id),
        place_name: String(place.name),
        place_neighborhood: String(place.neighborhood ?? ""),
        place_cover_photo_url:
          typeof place.cover_photo_url === "string"
            ? place.cover_photo_url
            : null,
        ...(kind === "review"
          ? {
              note_etoiles: Number(row.note_etoiles),
              note_globale: Number(row.note_globale ?? row.note_etoiles),
              note_cuisine: row.note_cuisine as number | null,
              note_cadre: row.note_cadre as number | null,
              note_service: row.note_service as number | null,
              texte_avis:
                typeof row.texte_avis === "string" ? row.texte_avis : null,
              photos: Array.isArray(row.photos)
                ? row.photos.filter((p): p is string => typeof p === "string")
                : [],
            }
          : {}),
      });
    }
  }
  const page = communityPage(items, size);
  const urls = await resolveReviewPhotoUrls(
    page.items.flatMap((item) => item.photos ?? [])
  );
  page.items = page.items.map((item) => ({
    ...item,
    photos: (item.photos ?? []).flatMap((path) =>
      urls.has(path) ? [urls.get(path)!] : []
    ),
  }));
  return page;
}
