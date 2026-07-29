// Score de matching composite — PRD §8.1, §8.2, §8.3 et §20.6
// Score brut = 0.15·cos + 0.30·dist + 0.30·note + 0.10·rec + 0.15·nov
// Affichage borné [50%, 99%] : `50 + score_final * 49` (PRD §8.3)
// Bonus favori +0.05 capped (Story 3.6 — signal FR-004).
//
// Moteur pur, total (no throw), sans I/O — cible #1 des tests unit
// (project-context §Testing Rules).

import type { Place, PlaceAdn } from "../types/place";
import type { UserPalais } from "../types/palais";

/** Poids canoniques figés — PRD §8.1. Modifier nécessite review tech lead + Kidam. */
export const WEIGHTS = {
  cosine: 0.15,
  distance: 0.30,
  note: 0.30,
  recency: 0.10,
  novelty: 0.15,
} as const;

/** Bonus favori — Story 3.6 FR-004. Capped sur [0, 1] dans computeRawScore. */
export const FAVORITE_BONUS = 0.05;

export interface MatchingContext {
  spawter_palais: UserPalais;
  spawter_lat: number;
  spawter_lng: number;
  /** Set des place_id déjà visités (PRD §8.2 novelty) */
  visited_place_ids: Set<string>;
  /** Set des place_id sauvegardés en favori (Story 3.6 FR-004) */
  saved_place_ids: Set<string>;
  now: Date;
}

export interface PlaceWithSignals {
  place: Place;
  adn: PlaceAdn;
  /** Date du dernier spawt validé sur le lieu (PRD §8.2 recency) */
  last_spawt_at: Date | null;
}

export interface PlaceWithScore {
  place: Place;
  adn: PlaceAdn;
  /** Score brut [0, 1] */
  raw_score: number;
  /** Score affiché [50, 99] (PRD §8.3) */
  match_score: number;
  /** Distance spawter → lieu en km (haversine) */
  distance_km: number;
}

/**
 * Calcule le score brut [0, 1] avant conversion en %.
 * Story 3.6 — ajoute `FAVORITE_BONUS` si le lieu est sauvegardé.
 */
export function computeRawScore(
  ctx: MatchingContext,
  candidate: PlaceWithSignals,
): number {
  const cos = cosineComponent(ctx.spawter_palais, candidate.adn);
  const dist = distanceComponent(
    ctx.spawter_lat,
    ctx.spawter_lng,
    candidate.place.location.lat,
    candidate.place.location.lng,
  );
  const note = noteComponent(candidate.adn.weighted_rating);
  const rec = recencyComponent(candidate.last_spawt_at, ctx.now);
  const nov = noveltyComponent(candidate.place.id, ctx.visited_place_ids);

  const base =
    WEIGHTS.cosine * cos +
    WEIGHTS.distance * dist +
    WEIGHTS.note * note +
    WEIGHTS.recency * rec +
    WEIGHTS.novelty * nov;

  const bonus = ctx.saved_place_ids.has(candidate.place.id) ? FAVORITE_BONUS : 0;
  return clamp(base + bonus, 0, 1);
}

/** Score affiché en pourcentage [50, 99] (PRD §8.3) */
export function displayedScore(rawScore: number): number {
  return Math.round(50 + clamp(rawScore, 0, 1) * 49);
}

/**
 * Ranke une liste de candidats par score composite décroissant.
 *
 * - Pure (no I/O), total (no throw), deterministic.
 * - Sort stable + tiebreaker `place.id.localeCompare` pour reproductibilité.
 * - Pas de mutation sur `candidates`.
 */
export function rankPlaces(
  ctx: MatchingContext,
  candidates: readonly PlaceWithSignals[],
): PlaceWithScore[] {
  const scored: PlaceWithScore[] = candidates.map((c) => {
    const raw_score = computeRawScore(ctx, c);
    return {
      place: c.place,
      adn: c.adn,
      raw_score,
      match_score: displayedScore(raw_score),
      distance_km: haversineKm(
        ctx.spawter_lat,
        ctx.spawter_lng,
        c.place.location.lat,
        c.place.location.lng,
      ),
    };
  });
  return scored.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    return a.place.id.localeCompare(b.place.id);
  });
}

// ── Composantes individuelles ────────────────────────

function cosineComponent(palais: UserPalais, adn: PlaceAdn): number {
  const u = [
    palais.axe_racines_horizons,
    palais.axe_taniere_nomade,
    palais.axe_exigeant_enthousiaste,
    palais.axe_foule_secret,
    palais.axe_maquis_table,
  ];
  const v = [
    adn.axe_local_international,
    adn.axe_informel_etabli,
    adn.axe_budget_premium,
    adn.axe_populaire_prive,
    adn.axe_decontracte_habille,
  ];
  const sim = cosine(u, v);
  // Normaliser [-1, 1] → [0, 1]
  return (sim + 1) / 2;
}

function distanceComponent(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const km = haversineKm(lat1, lng1, lat2, lng2);
  if (km <= 1) return 1;
  if (km <= 3) return 1 - (km - 1) * 0.15;
  if (km <= 5) return 0.7 - (km - 3) * 0.2;
  return Math.max(0, 0.3 - (km - 5) * 0.05);
}

function noteComponent(weightedRating: number): number {
  return clamp(weightedRating / 5, 0, 1);
}

function recencyComponent(lastSpawtAt: Date | null, now: Date): number {
  if (!lastSpawtAt) return 0;
  const days = (now.getTime() - lastSpawtAt.getTime()) / 86_400_000;
  return clamp(1 - days / 90, 0, 1);
}

function noveltyComponent(placeId: string, visited: Set<string>): number {
  return visited.has(placeId) ? 0.2 : 1;
}

// ── Helpers maths (exportés Story 3.3b — consommés par feed/search) ─

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Distance haversine en km entre 2 points (lat, lng).
 * Exporté Story 3.3b — partagé par feed/search/fiche lieu pour éviter le drift.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
