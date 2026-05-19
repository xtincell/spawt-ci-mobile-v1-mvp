// Story 3.5 — Moteur de recherche client-side (V1).
// Pure, total, sans I/O. Filtre + ranke selon query texte + filtres AND.
// V1 : `includes` accent-insensitive sur name + cuisine + neighborhood.
// V2 : full-text Supabase + index trigram si volume scale > 1000 lieux.

import type { PlaceWithAdn } from "./data-source";
import { haversineKm } from "./matching";

export interface SearchFilters {
  cuisines: ReadonlyArray<string>;
  budgetTiers: ReadonlyArray<1 | 2 | 3>;
  /** Distance maximale en km. null = pas de filtre. */
  distanceKm: number | null;
  /** Note minimale (entre 3.0 et 5.0). null = pas de filtre. */
  minRating: number | null;
}

export interface SearchContext {
  spawter_lat: number;
  spawter_lng: number;
}

export const EMPTY_FILTERS: SearchFilters = {
  cuisines: [],
  budgetTiers: [],
  distanceKm: null,
  minRating: null,
};

export function isFiltersEmpty(f: SearchFilters): boolean {
  return (
    f.cuisines.length === 0 &&
    f.budgetTiers.length === 0 &&
    f.distanceKm === null &&
    f.minRating === null
  );
}

/**
 * Normalisation française : NFD + suppression diacritiques + lowercase.
 * « café » et « cafe » deviennent identiques.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtre + ranke une liste de places selon query texte + filtres AND.
 *
 * - Si query vide ET filtres vides → retourne [] (caller affiche état vide).
 * - Match `includes` sur nom (poids 3), cuisine (poids 2), quartier (poids 1).
 * - Tri par pertinence descendante.
 */
export function searchPlaces(
  candidates: readonly PlaceWithAdn[],
  query: string,
  filters: SearchFilters,
  ctx: SearchContext,
): PlaceWithAdn[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0 && isFiltersEmpty(filters)) {
    return [];
  }

  const scored: Array<{ place: PlaceWithAdn; score: number }> = [];

  for (const place of candidates) {
    // Filtres AND
    if (
      filters.cuisines.length > 0 &&
      !filters.cuisines.some((c) =>
        (place.cuisine as readonly string[]).includes(c),
      )
    ) {
      continue;
    }
    if (
      filters.budgetTiers.length > 0 &&
      !filters.budgetTiers.includes(place.price.tier)
    ) {
      continue;
    }
    if (filters.minRating !== null && place.adn.weighted_rating < filters.minRating) {
      continue;
    }
    if (filters.distanceKm !== null) {
      const km = haversineKm(
        ctx.spawter_lat,
        ctx.spawter_lng,
        place.location.lat,
        place.location.lng,
      );
      if (km > filters.distanceKm) continue;
    }

    // Score de pertinence texte
    let score = 1; // baseline (match filtres déjà OK)
    if (normalizedQuery.length > 0) {
      const nameMatch = normalize(place.name).includes(normalizedQuery);
      const cuisineMatch = place.cuisine.some((c) =>
        normalize(c).includes(normalizedQuery),
      );
      const neighborhoodMatch = normalize(place.location.neighborhood).includes(
        normalizedQuery,
      );
      if (!nameMatch && !cuisineMatch && !neighborhoodMatch) {
        continue; // query active mais aucun match → exclu
      }
      score = 0;
      if (nameMatch) score += 3;
      if (cuisineMatch) score += 2;
      if (neighborhoodMatch) score += 1;
    }
    scored.push({ place, score });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.place.name.localeCompare(b.place.name);
    })
    .map((s) => s.place);
}
