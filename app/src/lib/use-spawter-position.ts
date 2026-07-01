// Câblage MVP — position réelle du spawter pour le ranking distance
// (feed, recherche, fiche lieu). Remplace les constantes DEMO_LAT/DEMO_LNG.
//
// Politique de permission : ce hook NE déclenche JAMAIS de prompt OS — il lit
// l'état accordé. Les prompts sont demandés aux bons moments par ailleurs :
// bootGuet (post-onboarding, gated consent ARTCI) et l'onglet Spawter (au
// moment de spawter). Permission absente → fallback Cocody Riviera silencieux
// (identique au comportement mode démo historique).

import { useEffect, useState } from "react";
import * as Location from "expo-location";

import { DEMO_LAT, DEMO_LNG } from "./demo-constants";

export interface SpawterPosition {
  lat: number;
  lng: number;
  /** "gps" = position réelle ; "fallback" = point de référence Cocody Riviera. */
  source: "gps" | "fallback";
}

export const FALLBACK_POSITION: SpawterPosition = {
  lat: DEMO_LAT,
  lng: DEMO_LNG,
  source: "fallback",
};

/**
 * Position du spawter, rafraîchie au mount. lastKnown d'abord (instantané,
 * zéro batterie), puis un fix Balanced si disponible. Web / Expo Go sans
 * module natif → fallback sans crash.
 */
export function useSpawterPosition(): SpawterPosition {
  const [position, setPosition] = useState<SpawterPosition>(FALLBACK_POSITION);

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
