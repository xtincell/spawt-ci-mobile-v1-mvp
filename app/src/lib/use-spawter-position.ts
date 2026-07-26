// Câblage MVP — position réelle du spawter pour le ranking distance
// (feed, recherche, fiche lieu). Remplace les constantes DEMO_LAT/DEMO_LNG.
//
// Politique de permission : ce hook NE déclenche JAMAIS de prompt OS — il lit
// l'état accordé. Les prompts sont demandés aux bons moments par ailleurs :
// bootGuet (post-onboarding, gated consent ARTCI) et l'onglet Spawter (au
// moment de spawter). Permission absente → fallback silencieux sur le point
// de référence de la ville active (multi-villes, lib/city.ts — Abidjan en V1,
// Dakar le jour venu sans toucher ce hook).

import { useEffect, useState } from "react";
import * as Location from "expo-location";

import { getActiveCity } from "./city";

export interface SpawterPosition {
  lat: number;
  lng: number;
  /** "gps" = position réelle ; "fallback" = point de référence de la ville active. */
  source: "gps" | "fallback";
}

/** Fallback dérivé de la ville active — recalculé à chaque mount du hook
 *  (la config peut être rafraîchie depuis la table `cities` entre-temps). */
export function getFallbackPosition(): SpawterPosition {
  const city = getActiveCity();
  return { lat: city.default_lat, lng: city.default_lng, source: "fallback" };
}

/**
 * Position du spawter, rafraîchie au mount. lastKnown d'abord (instantané,
 * zéro batterie), puis un fix Balanced si disponible. Web / Expo Go sans
 * module natif → fallback sans crash.
 */
export function useSpawterPosition(): SpawterPosition {
  const [position, setPosition] = useState<SpawterPosition>(getFallbackPosition);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") return;

        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          setPosition({
            lat: last.coords.latitude,
            lng: last.coords.longitude,
            source: "gps",
          });
        }

        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (fresh && !cancelled) {
          setPosition({
            lat: fresh.coords.latitude,
            lng: fresh.coords.longitude,
            source: "gps",
          });
        }
      } catch (err) {
        // Module natif absent (web) ou GPS indisponible — fallback silencieux.
        if (__DEV__) console.info("[use-spawter-position] fallback", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return position;
}
