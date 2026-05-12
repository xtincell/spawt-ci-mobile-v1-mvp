// Adaptateur de source de données.
//
// Mode FALLBACK (par défaut) : seed data locales, AsyncStorage pour le spawter.
// Mode SUPABASE : actif si EXPO_PUBLIC_SUPABASE_URL + ANON_KEY sont définis.
//
// Permet de livrer une première version fonctionnelle SANS payer Supabase,
// et de basculer en live sans toucher aux écrans.

import Constants from "expo-constants";

import type { Place, PlaceAdn } from "../types/place";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { SpawtCheckin } from "../types/spawt";

import { SEED_PLACES, type SeedPlace } from "../data/seed/places";

const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "";
const SUPABASE_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Mode courant — exposé pour debug + bandeau UI */
export const dataSourceMode: "supabase" | "fallback" = isSupabaseConfigured
  ? "supabase"
  : "fallback";

// ─── Public API ─────────────────────────────────────

export interface PlaceWithAdn extends Place {
  adn: PlaceAdn;
  rating_display: number;
  total_spawts: number;
}

export async function listPlaces(): Promise<PlaceWithAdn[]> {
  if (isSupabaseConfigured) {
    const { listPlacesFromSupabase } = await import("./data-source.supabase");
    return listPlacesFromSupabase();
  }
  return SEED_PLACES.map(seedToPlaceWithAdn);
}

export async function getPlace(id: string): Promise<PlaceWithAdn | null> {
  if (isSupabaseConfigured) {
    const { getPlaceFromSupabase } = await import("./data-source.supabase");
    return getPlaceFromSupabase(id);
  }
  const seed = SEED_PLACES.find((p) => p.id === id);
  return seed ? seedToPlaceWithAdn(seed) : null;
}

export async function listSpawtsForSpawter(spawter_id: string): Promise<SpawtCheckin[]> {
  if (isSupabaseConfigured) {
    const { listSpawtsFromSupabase } = await import("./data-source.supabase");
    return listSpawtsFromSupabase(spawter_id);
  }
  return [];
}

export async function saveSpawter(spawter: Spawter): Promise<void> {
  if (isSupabaseConfigured) {
    const { saveSpawterToSupabase } = await import("./data-source.supabase");
    await saveSpawterToSupabase(spawter);
    return;
  }
  // Fallback : géré côté store (AsyncStorage via spawter-store)
}

export async function savePalais(palais: UserPalais): Promise<void> {
  if (isSupabaseConfigured) {
    const { savePalaisToSupabase } = await import("./data-source.supabase");
    await savePalaisToSupabase(palais);
    return;
  }
  // Fallback : géré côté store
}

// ─── Helpers ─────────────────────────────────────────

function seedToPlaceWithAdn(seed: SeedPlace): PlaceWithAdn {
  const { adn, rating_display, total_spawts, ...place } = seed;
  return { ...place, adn, rating_display, total_spawts };
}
