// Implémentation Supabase — chargée dynamiquement par data-source.ts
// quand EXPO_PUBLIC_SUPABASE_URL + ANON_KEY sont configurés.

import { supabase } from "./supabase";
import type { Place, PlaceAdn } from "../types/place";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { SpawtCheckin } from "../types/spawt";
import type { FeatureFlag } from "../types/feature-flag";
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

/**
 * Liste les feature flags pour un spawter (Story 1.8).
 * RLS filtre serveur-side : globaux + overrides du spawter authentifié, et
 * exclut les flags expirés (`expires_at > now()`). Pas de filtre client —
 * évite les bugs de clock skew device.
 */
export async function listFeatureFlagsFromSupabase(
  spawter_id: string | null,
): Promise<FeatureFlag[]> {
  void spawter_id; // filtre RLS-side via auth.uid().
  const { data, error } = await supabase.from("feature_flags").select("*");
  if (error) {
    if (__DEV__) console.warn("[feature_flags] list failed", error);
    return [];
  }
  return (data ?? []) as FeatureFlag[];
}

/**
 * Insert un batch de signaux analytics dans la table append-only `user_signals`
 * (Story 1.7 — refactor Decisions D2+D3). Fire-and-forget — pas de await côté
 * caller métier. La column DB `spawter_id` a `DEFAULT auth.uid()` ; la RLS
 * valide aussi en `WITH CHECK`. Sans session auth (pre-OTP), l'insert échoue
 * côté RLS — le wrapper analytics persiste alors le batch dans AsyncStorage
 * et retentera au prochain `SIGNED_IN` (Story 2.3).
 *
 * @returns `true` si l'insert a réussi, `false` sinon. Le wrapper analytics
 * utilise ce signal pour décider de persister ou non.
 */
export async function insertUserSignals(
  payloads: readonly {
    signal_type: string;
    event_name: string;
    place_id: string | null;
    metadata: object;
  }[],
): Promise<boolean> {
  if (payloads.length === 0) return true;
  const { error } = await supabase.from("user_signals").insert(payloads as object[]);
  if (error) {
    if (__DEV__) console.warn("[user_signals] batch insert failed", error);
    return false;
  }
  return true;
}
