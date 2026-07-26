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

// ─── Chantier 13 archétypes — archétype courant (colonne 0033) ─────────────

/**
 * Écrit l'archétype courant du spawter (colonne `spawters.quiz_archetype`,
 * migration 0033). UPDATE ciblé (pas d'upsert row entier) : ne clobber aucune
 * autre colonne et sert aux DEUX flux — héritage quiz ET recalculs mue.
 * Mode démo : no-op — l'archétype vit dans le store (AsyncStorage).
 */
export async function updateSpawterArchetype(
  spawter_id: string,
  quiz_archetype: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { updateSpawterArchetypeInSupabase } = await import("./data-source.supabase");
  await updateSpawterArchetypeInSupabase(spawter_id, quiz_archetype);
}

/**
 * Lit l'archétype courant + le n° pionnier depuis `spawters` (0033).
 * Sert au rattrapage hydrate : un claim `claim_meute_heritage` effectué
 * server-side (autre device, OTP antérieur) est adopté si le local n'a rien.
 * Retourne null en mode démo ou sur échec réseau (le caller garde le local).
 */
export async function fetchSpawterArchetype(
  spawter_id: string,
): Promise<{ quiz_archetype: string | null; pionnier_seq: number | null } | null> {
  if (!isSupabaseConfigured) return null;
  const { fetchSpawterArchetypeFromSupabase } = await import("./data-source.supabase");
  return fetchSpawterArchetypeFromSupabase(spawter_id);
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

// Flags PRODUIT actifs par défaut en mode démo (fallback sans Supabase, ex.
// préversion web) : prix moyen F CFA + question « Pays d'origine ». Les flags
// d'infra (guet-geofence, paywall-geo) restent absents en démo — comportement
// historique conservé. En mode live, la table feature_flags (togglable depuis
// le dashboard admin, page Fonctionnalités) fait foi.
const DEMO_EPOCH = "2026-07-07T00:00:00Z";
const DEMO_FEATURE_FLAGS: FeatureFlag[] = (
  ["place-avg-price", "onboarding-origin-country"] as const
).flatMap((flag_code) =>
  (["internal", "alpha", "beta", "prod"] as const).map((scope) => ({
    id: `demo-${flag_code}-${scope}`,
    flag_code,
    scope,
    enabled: true,
    spawter_id: null,
    expires_at: null,
    created_at: DEMO_EPOCH,
    updated_at: DEMO_EPOCH,
  })),
);

/**
 * Liste les feature flags pertinents pour un spawter.
 * - Mode supabase : flags globaux (`spawter_id IS NULL`) + overrides du spawter.
 * - Mode fallback : flags produit par défaut (DEMO_FEATURE_FLAGS).
 */
export async function listFeatureFlags(spawter_id: string | null): Promise<FeatureFlag[]> {
  if (isSupabaseConfigured) {
    const { listFeatureFlagsFromSupabase } = await import("./data-source.supabase");
    return listFeatureFlagsFromSupabase(spawter_id);
  }
  return DEMO_FEATURE_FLAGS;
}

// ─── Story 4.9 — reviews d'un lieu ──────────────

/**
 * Avis spawter agrégé pour affichage sur la fiche lieu (Story 4.9).
 *
 * `is_seed = true` → avis fondateur seedé en DB (Story 6.3) ; il alimente
 * l'ADN mais reste hors du compteur public `total_reviews`. La fiche lieu V1
 * les affiche **avec** un badge « Avis fondateur » pour assumer la démo.
 */
export interface PlaceReview {
  /** spawt_checkin.id (UUID) — clé React stable. */
  id: string;
  spawter_id: string;
  spawter_display_name: string;
  spawter_avatar_url: string | null;
  /** 1-5, demi-points possibles côté DB mais arrondi par Stars. */
  note_etoiles: number;
  texte_avis: string | null;
  /** URLs publiques des photos (0..3). Story 4.5 = bucket place-photos, seeds = Unsplash CDN. */
  photos: readonly string[];
  created_at: string;
  is_seed: boolean;
}

/**
 * Liste les avis (max `limit`) d'un lieu, tri qualité-puis-fraîcheur.
 *
 * Mode fallback (sans Supabase) : retourne `[]` — les seeds reviews ne sont
 * pas embarqués côté mobile (volume trop élevé). La fiche affiche alors
 * l'état vide via `reviews_empty`. Mode supabase : join `spawters!inner` en
 * un round-trip.
 */
export async function listReviewsForPlace(
  placeId: string,
  limit = 5,
): Promise<PlaceReview[]> {
  if (isSupabaseConfigured) {
    const { listReviewsForPlaceFromSupabase } = await import(
      "./data-source.supabase"
    );
    return listReviewsForPlaceFromSupabase(placeId, limit);
  }
  return [];
}

/**
 * Story 4.12 — Compte total des avis d'un lieu (même filtre que
 * `listReviewsForPlace` : `note_etoiles IS NOT NULL`, seeds inclus). Sert à
 * décider l'affichage du lien « Voir tous les avis (N) » avec le vrai N.
 *
 * Requête `head: true, count: 'exact'` → pas de transfert de lignes. Mode
 * fallback : retourne 0 (aucun avis embarqué côté mobile en démo).
 */
export async function countReviewsForPlace(placeId: string): Promise<number> {
  if (isSupabaseConfigured) {
    const { countReviewsForPlaceFromSupabase } = await import(
      "./data-source.supabase"
    );
    return countReviewsForPlaceFromSupabase(placeId);
  }
  return 0;
}

/**
 * Refonte fiche lieu (R17/Q1) — photos des spawts d'un lieu, pour la
 * « galerie des spawters » de l'onglet Média.
 *
 * Mode supabase : photos des avis publics du lieu (champ `photos TEXT[]` de
 * `spawt_checkin`, migration 0011 — visibilité RLS 0021). Mode fallback
 * (démo) : photos des spawts locaux du device (AsyncStorage) — dégradé
 * acceptable, aucune photo communautaire embarquée côté mobile.
 */
export async function listPlacePhotosFromSpawts(
  placeId: string,
  limit = 30,
): Promise<string[]> {
  if (isSupabaseConfigured) {
    const { listPlacePhotosFromSpawtsFromSupabase } = await import(
      "./data-source.supabase"
    );
    return listPlacePhotosFromSpawtsFromSupabase(placeId, limit);
  }
  try {
    // Import dynamique — cohérent avec le pattern data-source ; évite de
    // charger AsyncStorage pour les consumers qui n'appellent jamais ceci.
    const { loadSpawts } = await import("./storage");
    const spawts = await loadSpawts();
    const photos: string[] = [];
    for (const s of spawts) {
      if (s.place_id !== placeId || s.is_cancelled) continue;
      for (const p of s.photos ?? []) {
        if (typeof p === "string" && p.length > 0) {
          photos.push(p);
          if (photos.length >= limit) return photos;
        }
      }
    }
    return photos;
  } catch (err) {
    if (__DEV__) console.warn("[data-source] listPlacePhotosFromSpawts (démo) failed", err);
    return [];
  }
}

/**
 * Câblage MVP — favoris cross-device (Story 3.6 Option A, migration 0024).
 * Retourne null si Supabase indisponible ou fetch en échec (le caller garde
 * alors le cache local sans merge).
 */
export async function listSavedPlaceIds(spawter_id: string): Promise<string[] | null> {
  if (!isSupabaseConfigured) return null;
  const { listSavedPlaceIdsFromSupabase } = await import("./data-source.supabase");
  return listSavedPlaceIdsFromSupabase(spawter_id);
}

export async function saveSavedPlace(spawter_id: string, place_id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { insertSavedPlaceToSupabase } = await import("./data-source.supabase");
  await insertSavedPlaceToSupabase(spawter_id, place_id);
}

export async function deleteSavedPlace(spawter_id: string, place_id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { deleteSavedPlaceFromSupabase } = await import("./data-source.supabase");
  await deleteSavedPlaceFromSupabase(spawter_id, place_id);
}

/**
 * Câblage MVP — signalement d'avis (Feature 17, migration 0026).
 * "duplicate" = déjà signalé par ce spawter (contrainte UNIQUE).
 * Mode démo → "unavailable" (le bouton est masqué en amont).
 */
export async function reportReview(input: {
  spawt_checkin_id: string;
  reporter_spawter_id: string;
  reason_code: "fake_review" | "hater" | "gatekeeping" | "autre";
  commentaire?: string;
}): Promise<"ok" | "duplicate" | "error" | "unavailable"> {
  if (!isSupabaseConfigured) return "unavailable";
  const { reportReviewToSupabase } = await import("./data-source.supabase");
  return reportReviewToSupabase(input);
}

/** Phase 2 F12 — Coup de Cœur via RPC quota (migration 0028). */
export interface CoupDeCoeurResult {
  ok: boolean;
  code: "given" | "already_given" | "quota_exhausted" | "not_authenticated" | string;
  quota?: number;
  used?: number;
  remaining?: number;
}

export async function giveCoupDeCoeur(
  place_id: string,
): Promise<CoupDeCoeurResult | null> {
  if (!isSupabaseConfigured) return null;
  const { giveCoupDeCoeurToSupabase } = await import("./data-source.supabase");
  return giveCoupDeCoeurToSupabase(place_id);
}

export async function countCoupsDeCoeurThisMonth(
  place_id: string,
): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  const { countCoupsDeCoeurFromSupabase } = await import("./data-source.supabase");
  return countCoupsDeCoeurFromSupabase(place_id);
}

// ─── Feature 13 — push serveur : tokens Expo par device (migration 0034) ────

/**
 * Upsert du token push du device dans `push_tokens` (ON CONFLICT token :
 * un device qui se ré-enregistre met à jour sa row — RLS owner-only).
 * Mode démo : no-op silencieux, aucun push serveur sans Supabase.
 */
export async function upsertPushToken(
  token: string,
  platform: "ios" | "android",
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { upsertPushTokenToSupabase } = await import("./data-source.supabase");
  await upsertPushTokenToSupabase(token, platform);
}

/** Retrait du token au logout / suppression de compte. Mode démo : no-op. */
export async function deletePushToken(token: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { deletePushTokenFromSupabase } = await import("./data-source.supabase");
  await deletePushTokenFromSupabase(token);
}

/** Phase 2 — suppression de compte self-service (migration 0029, ARTCI). */
export async function requestAccountDeletion(): Promise<boolean> {
  if (!isSupabaseConfigured) return true; // démo : reset local suffit
  const { requestAccountDeletionFromSupabase } = await import("./data-source.supabase");
  return requestAccountDeletionFromSupabase();
}

/** Phase 2 — fil d'activité de la Meute (onglet Meute). */
export interface MeuteActivityItem {
  kind: "review" | "coup";
  id: string;
  created_at: string;
  spawter_display_name: string;
  spawter_avatar_url: string | null;
  place_id: string;
  place_name: string;
  place_neighborhood: string;
  /** Renseigné pour kind="review". */
  note_etoiles?: number;
  texte_avis?: string | null;
}

export async function listMeuteActivity(limit = 30): Promise<MeuteActivityItem[]> {
  if (!isSupabaseConfigured) return [];
  const { listMeuteActivityFromSupabase } = await import("./data-source.supabase");
  return listMeuteActivityFromSupabase(limit);
}

// ─── Helpers ─────────────────────────────────────────

function seedToPlaceWithAdn(seed: SeedPlace): PlaceWithAdn {
  const { adn, rating_display, total_spawts, ...place } = seed;
  return { ...place, adn, rating_display, total_spawts };
}
