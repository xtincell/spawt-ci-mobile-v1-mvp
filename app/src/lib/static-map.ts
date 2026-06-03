// Story 4.12 — Carte de localisation sous l'adresse (image statique).
//
// Décision proposal §4.6 / Batch 6.2 : carte = IMAGE STATIQUE (1 GET image, pas
// de dépendance native). `react-native-maps` interactif = defer Sprint 2.
//
// Clé API lue via EXPO_PUBLIC_* (pattern Constants.expoConfig?.extra, cf.
// data-source.ts / supabase.ts). C'est une clé CLIENT inlinée dans le bundle —
// la restreindre par référent/quota côté provider. JAMAIS un secret serveur.

import Constants from "expo-constants";

const MAPBOX_TOKEN =
  (Constants.expoConfig?.extra?.mapboxToken as string | undefined) ??
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ??
  "";

const GOOGLE_MAPS_KEY =
  (Constants.expoConfig?.extra?.googleMapsKey as string | undefined) ??
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ??
  "";

/** Provider actif : Mapbox prioritaire si token présent, sinon Google. */
export type StaticMapProvider = "mapbox" | "google" | null;

export function staticMapProvider(): StaticMapProvider {
  if (MAPBOX_TOKEN.length > 0) return "mapbox";
  if (GOOGLE_MAPS_KEY.length > 0) return "google";
  return null;
}

export interface StaticMapOptions {
  /** Largeur/hauteur en points logiques (le @2x est ajouté côté provider). */
  width?: number;
  height?: number;
  zoom?: number;
}

/**
 * Construit l'URL d'une image carte statique centrée sur (lat, lng) avec un
 * marqueur. Retourne `null` si aucune clé n'est configurée OU si les coords
 * sont invalides → l'appelant retombe sur l'adresse texte seule (AC #1 fallback).
 *
 * Injection `provider`/`token`/`key` pour les tests (sinon lit l'env au build).
 */
export function buildStaticMapUrl(
  lat: number,
  lng: number,
  opts: StaticMapOptions = {},
  overrides?: {
    provider?: StaticMapProvider;
    mapboxToken?: string;
    googleKey?: string;
  },
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null; // coord nulle = lieu sans géoloc

  const width = opts.width ?? 600;
  const height = opts.height ?? 280;
  const zoom = opts.zoom ?? 15;

  const provider = overrides?.provider ?? staticMapProvider();
  const mapboxToken = overrides?.mapboxToken ?? MAPBOX_TOKEN;
  const googleKey = overrides?.googleKey ?? GOOGLE_MAPS_KEY;

  if (provider === "mapbox" && mapboxToken.length > 0) {
    // pin-s rouge + style streets. Mapbox attend lng,lat (ordre inversé).
    const marker = `pin-s+c8a44e(${lng},${lat})`;
    return (
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
      `${marker}/${lng},${lat},${zoom}/${width}x${height}@2x` +
      `?access_token=${mapboxToken}`
    );
  }

  if (provider === "google" && googleKey.length > 0) {
    return (
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=2` +
      `&markers=color:0xc8a44e%7C${lat},${lng}&key=${googleKey}`
    );
  }

  return null;
}

/**
 * Deeplink natif vers l'app cartes. `geo:` est honoré par Android ; iOS ne le
 * gère pas toujours → l'appelant teste `Linking.canOpenURL` et retombe sur
 * `appleMapsUrl`. Le label encodé apparaît comme requête de recherche.
 */
export function geoUrl(lat: number, lng: number, label?: string): string {
  const q = label ? `(${encodeURIComponent(label)})` : "";
  return `geo:${lat},${lng}?q=${lat},${lng}${q}`;
}

export function appleMapsUrl(lat: number, lng: number, label?: string): string {
  const q = label ? `&q=${encodeURIComponent(label)}` : "";
  return `https://maps.apple.com/?ll=${lat},${lng}${q}`;
}
