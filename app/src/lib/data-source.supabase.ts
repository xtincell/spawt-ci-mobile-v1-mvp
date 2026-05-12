// Implémentation Supabase — chargée dynamiquement par data-source.ts
// quand EXPO_PUBLIC_SUPABASE_URL + ANON_KEY sont configurés.

import { supabase } from "./supabase";
import type { Place, PlaceAdn } from "../types/place";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { SpawtCheckin } from "../types/spawt";
import type { PlaceWithAdn } from "./data-source";

export async function listPlacesFromSupabase(): Promise<PlaceWithAdn[]> {
  const { data: places, error } = await supabase
    .from("places")
    .select("*, place_adn(*)")
    .eq("is_published", true);

  if (error) {
    console.error("[data-source] listPlaces failed", error);
    return [];
  }

  return (places ?? []).map((row): PlaceWithAdn => ({
    ...(row as Place),
    adn: row.place_adn as PlaceAdn,
    rating_display: (row.place_adn as PlaceAdn).weighted_rating,
    total_spawts: (row as { total_spawts?: number }).total_spawts ?? 0,
  }));
}

export async function getPlaceFromSupabase(id: string): Promise<PlaceWithAdn | null> {
  const { data, error } = await supabase
    .from("places")
    .select("*, place_adn(*)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return {
    ...(data as Place),
    adn: data.place_adn as PlaceAdn,
    rating_display: (data.place_adn as PlaceAdn).weighted_rating,
    total_spawts: (data as { total_spawts?: number }).total_spawts ?? 0,
  };
}

export async function listSpawtsFromSupabase(spawter_id: string): Promise<SpawtCheckin[]> {
  const { data, error } = await supabase
    .from("spawt_checkin")
    .select("*")
    .eq("spawter_id", spawter_id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as SpawtCheckin[];
}

export async function saveSpawterToSupabase(spawter: Spawter): Promise<void> {
  await supabase.from("spawters").upsert(spawter);
}

export async function savePalaisToSupabase(palais: UserPalais): Promise<void> {
  await supabase.from("user_palais").upsert(palais);
}
