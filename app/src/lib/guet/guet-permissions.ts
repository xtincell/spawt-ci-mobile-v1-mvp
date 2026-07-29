// Story 4.2 — Permission `expo-notifications` runtime.
// Gating : pas demandée avant que `geoloc_consent_at` soit posé (ARTCI Story 2.2 set-once).
// Refus utilisateur : non-bloquant — Le Guet continue d'arming, le spawt sera
// enregistré `passive` à la fenêtre +30min (AC #1 Story 4.2).

import * as Notifications from "expo-notifications";

import { ensureGuetChannel } from "./guet-notifications";

/**
 * Demande la permission de notifications post-OTP, gated sur geoloc_consent_at.
 * Idempotent côté Notifications API (request retourne déjà OK si déjà accordé).
 */
export async function ensureNotifPermissionPostOTP(
  hasGeolocConsent: boolean,
): Promise<"granted" | "denied" | "skipped"> {
  if (!hasGeolocConsent) {
    if (__DEV__) {
      console.info("[guet-permissions] notif permission skipped — no geoloc consent yet");
    }
    return "skipped";
  }
  await ensureGuetChannel();
  try {
    // expo-notifications PermissionResponse expose `granted` + `canAskAgain` —
    // cast typé minimal car le `.d.ts` packagé n'inclut pas toujours ces props
    // selon la version résolue de `expo-modules-core`.
    const existing = (await Notifications.getPermissionsAsync()) as unknown as {
      granted?: boolean;
      canAskAgain?: boolean;
    };
    if (existing.granted) return "granted";
    if (existing.canAskAgain === false) return "denied";
    const result = (await Notifications.requestPermissionsAsync()) as unknown as {
      granted?: boolean;
    };
    return result.granted ? "granted" : "denied";
  } catch (err) {
    if (__DEV__) console.warn("[guet-permissions] ensureNotifPermissionPostOTP failed", err);
    return "denied";
  }
}
