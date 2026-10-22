// Story 4.1 — Wrapper expo-location pour Le Guet (geofencing background).
//
// API publique : armGuet, disarmGuet, isGuetArmed, selectClosestPlaces (pure helper exposé pour tests).
//
// Garde-fous V1 (NFR-GEO + cahier Sprint 1 §5.8) :
//   - Mode démo (fallback / Expo Go) → no-op silencieux.
//   - Consent géoloc absent (`spawter.geoloc_consent_at === null`) → no-op + warn.
//   - Feature flag `guet-proximity-v2` désactivé → no-op + log.
//   - Cap MAX_ACTIVE_GEOFENCES = 20 (limite iOS CLLocationManager + battery Android).
//
// Permissions runtime demandées lazy au moment de `armGuet` — pas au boot
// (cohérent ARTCI Story 2.2 set-once `geoloc_consent_at`).

import * as Location from "expo-location";

import { dataSourceMode } from "../data-source";
import { useFeatureFlagsStore } from "../../store/feature-flags";
import { haversineKm } from "../matching";
import { GUET_TASK } from "./guet-task";

export const MAX_ACTIVE_GEOFENCES = 20;
export const GEOFENCE_RADIUS_METERS = 150;

export interface ArmablePlace {
  id: string;
  lat: number;
  lng: number;
}

export interface SpawterLocation {
  lat: number;
  lng: number;
}

let armedPlaceIds: Set<string> = new Set();

/**
 * Sélectionne les N lieux les plus proches d'une position spawter via haversine.
 * Pure helper — exposé pour les tests unit (architecture §Testing Rules).
 */
export function selectClosestPlaces<T extends ArmablePlace>(
  places: ReadonlyArray<T>,
  spawter: SpawterLocation,
  max: number = MAX_ACTIVE_GEOFENCES,
): T[] {
  if (places.length <= max) return [...places];
  const withDistance = places.map((p) => ({
    place: p,
    distance: haversineKm(spawter.lat, spawter.lng, p.lat, p.lng),
  }));
  withDistance.sort((a, b) => a.distance - b.distance);
  return withDistance.slice(0, max).map((entry) => entry.place);
}

/**
 * Arme N geofences (150m radius) sur les lieux fournis. Idempotent : re-arme = reset.
 *
 * No-op si :
 *  - mode démo (`dataSourceMode === "fallback"`)
 *  - consent géoloc non posé (`hasGeolocConsent === false`)
 *  - feature flag `guet-proximity-v2` désactivé
 *  - permission foreground refusée
 *
 * Background permission refusée → désarmement. Les actions manuelles restent disponibles.
 */
export async function armGuet(
  places: ReadonlyArray<ArmablePlace>,
  options: { spawter?: SpawterLocation; hasGeolocConsent: boolean } = { hasGeolocConsent: false },
): Promise<void> {
  if (dataSourceMode === "fallback") {
    if (__DEV__) console.info("[guet] armGuet skipped — mode démo");
    return;
  }
  if (!options.hasGeolocConsent) {
    if (__DEV__) console.warn("[guet] armGuet skipped — geoloc consent absent");
    return;
  }
  if (!isGuetFlagEnabled()) {
    if (__DEV__) console.info("[guet] armGuet skipped — flag guet-proximity-v2 disabled");
    return;
  }
  if (places.length === 0 || !options.spawter) { await disarmGuet(); return; }

  // Permission foreground d'abord — sans elle, on ne peut rien armer.
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      if (__DEV__) console.warn("[guet] armGuet aborted — foreground permission denied");
      return;
    }
    // Une permission de premier plan seule ne permet pas les geofences natives.
    if (typeof Location.requestBackgroundPermissionsAsync === "function") {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== "granted") { await disarmGuet(); return; }
    }
  } catch (err) {
    if (__DEV__) console.warn("[guet] permission request failed", err);
    return;
  }

  // Cap 20 — si > MAX, garder les plus proches du spawter.
  const target = options.spawter
    ? selectClosestPlaces(places, options.spawter)
    : places.slice(0, MAX_ACTIVE_GEOFENCES);
  if (places.length > MAX_ACTIVE_GEOFENCES && __DEV__) {
    console.info(
      `[guet] capping geofences ${places.length} → ${MAX_ACTIVE_GEOFENCES}`,
    );
  }

  const regions = target.map((p) => ({
    identifier: p.id,
    latitude: p.lat,
    longitude: p.lng,
    radius: GEOFENCE_RADIUS_METERS,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));

  try {
    await Location.startGeofencingAsync(GUET_TASK, regions);
    armedPlaceIds = new Set(target.map((p) => p.id));
  } catch (err) {
    if (__DEV__) console.warn("[guet] startGeofencingAsync failed", err);
  }
}

/** Désarme toutes les geofences (logout, opt-out géoloc, reset). */
export async function disarmGuet(): Promise<void> {
  try {
    const isRegistered =
      typeof Location.hasStartedGeofencingAsync === "function"
        ? await Location.hasStartedGeofencingAsync(GUET_TASK)
        : armedPlaceIds.size > 0;
    if (isRegistered) {
      await Location.stopGeofencingAsync(GUET_TASK);
    }
  } catch (err) {
    if (__DEV__) console.warn("[guet] disarmGuet failed", err);
  } finally {
    armedPlaceIds = new Set();
  }
}

/** True si Le Guet est armé sur au moins 1 lieu. Status diagnostic / UI banner. */
export async function isGuetArmed(): Promise<boolean> {
  if (typeof Location.hasStartedGeofencingAsync === "function") {
    try {
      return await Location.hasStartedGeofencingAsync(GUET_TASK);
    } catch {
      return armedPlaceIds.size > 0;
    }
  }
  return armedPlaceIds.size > 0;
}

/** Set des place_id actuellement armés. Exposé pour tests + diagnostic. */
export function getArmedPlaceIds(): ReadonlySet<string> {
  return armedPlaceIds;
}

/** Test-only : reset l'état armé. */
export function _resetArmedForTest(): void {
  armedPlaceIds = new Set();
}

function isGuetFlagEnabled(): boolean {
  return Boolean(useFeatureFlagsStore.getState().flags?.["guet-proximity-v2"]);
}
