// Story 4.10 — Helper pur pour lister les lieux proches du spawter.
//
// Consommé par l'écran `(tabs)/spawter.tsx` (déclenché par le FAB central).
// Filtre les `PlaceWithAdn` publiés sur un rayon de NEARBY_RADIUS_KM (2km),
// trie par distance ascendante, cape à `limit` (5 par défaut).
//
// `is_within_spawt_range` (distance < 0.1km) sert au caller à décider de
// `is_verified` sur le `SpawtCheckin` produit par `buildManualSpawt()` —
// cohérent avec la geofence de 10m du Guet (PRD §7.1) et le poids
// PASSIVE_CHECKIN_WEIGHT (PRD §7.2) pour les spawts hors-zone.
//
// Pure (no I/O), total (no throw), deterministic — testable unitairement.

import type { PlaceWithAdn } from "./data-source";
import { haversineKm } from "./matching";

/** Rayon de recherche V1 — Story 4.10 spec §"Décisions héritées". */
export const NEARBY_RADIUS_KM = 2;

/**
 * Distance max pour considérer le spawter "sur place" (is_verified=true).
 * 100m = cohérent avec la geofence de 10m du Guet + marge accuracy GPS
 * (NFR-GEO-02 tolère jusqu'à 30m). PRD §7.2 — au-delà, poids passif 0.5x.
 */
export const SPAWT_RANGE_KM = 0.1;

export interface NearbyPlace {
  place: PlaceWithAdn;
  /** Distance en km (haversine) entre le spawter et le lieu. */
  distance_km: number;
  /** `true` si distance < SPAWT_RANGE_KM (100m). */
  is_within_spawt_range: boolean;
}

/**
 * Liste les lieux proches du spawter, triés par distance ascendante.
 *
 * @param places  Catalogue de lieux (filtré sur `is_published === true`).
 * @param userLat Latitude du spawter (degrés décimaux).
 * @param userLng Longitude du spawter (degrés décimaux).
 * @param limit   Cap de la liste retournée (5 par défaut — UX focalisée).
 */
export function listNearbyPlaces(
  places: readonly PlaceWithAdn[],
  userLat: number,
  userLng: number,
  limit = 5,
): NearbyPlace[] {
  return places
    .filter((p) => p.is_published)
    .map((place) => {
      const distance_km = haversineKm(
        userLat,
        userLng,
        place.location.lat,
        place.location.lng,
      );
      return {
        place,
        distance_km,
        is_within_spawt_range: distance_km < SPAWT_RANGE_KM,
      };
    })
    .filter((np) => np.distance_km <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, Math.max(0, limit));
}

/**
 * Formate une distance en km pour l'affichage UX.
 *  - <1km → "NNN m" (entier arrondi).
 *  - ≥1km → "N.N km" (1 décimale).
 *
 * Spec §"Dev Notes §1 — Format distance".
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
