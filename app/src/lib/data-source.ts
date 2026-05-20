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
import type { FeatureFlag } from "../types/feature-flag";
import type { CollectionTitreRow } from "../types/collection-titres";
import type { Stade } from "../types/stade";

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

/**
 * Story 4.3 — Upsert idempotent `spawt_checkin`. En mode fallback (démo), le
 * store gère le local-only via AsyncStorage et on retourne `true` silencieusement.
 */
export async function upsertSpawt(row: SpawtCheckin): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const mod = await import("./data-source.supabase");
  return mod.upsertSpawtToSupabase(row);
}

/** Story 4.3 — Update partial `spawt_checkin` par id. */
export async function updateSpawt(
  row_id: string,
  patch: Partial<SpawtCheckin>,
): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const mod = await import("./data-source.supabase");
  return mod.updateSpawtInSupabase(row_id, patch);
}

// ─── Story 5.1 — progression par stade ──────────────

export interface ProgressionRow {
  spawter_id: string;
  unique_spots: number;
  stade: Stade;
  /** i18n key — défaut `title.<stade>` (Story 5.2 livre la mapping enrichie). */
  current_title: string;
  updated_at: string;
}

/**
 * Story 5.1 — Upsert idempotent `spawter_progression` (overwrite par PK = spawter_id).
 * Fire-and-forget côté caller. Mode fallback : no-op silencieux.
 */
export async function upsertProgression(row: ProgressionRow): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { upsertProgressionToSupabase } = await import("./data-source.supabase");
  await upsertProgressionToSupabase(row);
}

// ─── Story 5.2 — collection de titres ──────────────

export async function insertTitre(row: CollectionTitreRow): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { insertTitreToSupabase } = await import("./data-source.supabase");
  await insertTitreToSupabase(row);
}

export async function setDisplayedTitre(
  spawter_id: string,
  title_key: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { setDisplayedTitreInSupabase } = await import("./data-source.supabase");
  await setDisplayedTitreInSupabase(spawter_id, title_key);
}

export async function listTitresForSpawter(
  spawter_id: string,
): Promise<CollectionTitreRow[]> {
  if (!isSupabaseConfigured) return [];
  const { listTitresFromSupabase } = await import("./data-source.supabase");
  return listTitresFromSupabase(spawter_id);
}

/**
 * Liste les feature flags pertinents pour un spawter.
 * - Mode supabase : flags globaux (`spawter_id IS NULL`) + overrides du spawter.
 * - Mode fallback : tableau vide (aucun flag en démo).
 */
export async function listFeatureFlags(spawter_id: string | null): Promise<FeatureFlag[]> {
  if (isSupabaseConfigured) {
    const { listFeatureFlagsFromSupabase } = await import("./data-source.supabase");
    return listFeatureFlagsFromSupabase(spawter_id);
  }
  return [];
}

// ─── Helpers ─────────────────────────────────────────

function seedToPlaceWithAdn(seed: SeedPlace): PlaceWithAdn {
  const { adn, rating_display, total_spawts, ...place } = seed;
  return { ...place, adn, rating_display, total_spawts };
}
