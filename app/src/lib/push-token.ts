// Feature 13 — Push serveur : enregistrement du token Expo + routage des taps.
//
// Trois responsabilités :
//   1. `registerPushToken()` — appelé au Root layout dès qu'un spawter onboardé
//      existe (login réussi OU boot avec session — même effet que bootGuet).
//      Permission notifications via le MÊME helper que le Guet
//      (`ensureNotifPermissionPostOTP`, idempotent) pour ne JAMAIS déclencher
//      une double demande système, puis `getExpoPushTokenAsync` + upsert dans
//      `push_tokens` (migration 0034) via le data layer. Mode démo : no-op.
//   2. `unregisterPushToken()` — logout / suppression de compte : DELETE du
//      token côté Supabase. RLS owner-only → à appeler AVANT
//      `supabase.auth.signOut()` (cf. settings.tsx).
//   3. `registerPushResponseHandler()` — tap d'une notification push serveur →
//      route vers `data.deep_link`. Listener SÉPARÉ de celui du Guet
//      (guet-notifications) : les payloads sont disjoints (row_id/place_id =
//      Guet, deep_link = push serveur), chacun ignore ceux de l'autre — les
//      catégories Confirmer/Snooze du Guet restent intactes.
//
// Dégradation propre (documentée dans RUNBOOK_SOUMISSION_STORES) : sur Android
// SANS google-services.json (FCM pas encore configuré par le client),
// `getExpoPushTokenAsync` THROW. On warn UNE seule fois, on retourne null et
// l'app continue — les notifs locales du Guet ne dépendent pas de FCM.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, type Href } from "expo-router";

import { upsertPushToken, deletePushToken } from "./data-source";
import { ensureNotifPermissionPostOTP } from "./guet/guet-permissions";
import { useSpawterStore } from "../store/spawter-store";

/** Dernier token enregistré — persiste pour le DELETE au logout (app relancée). */
const PUSH_TOKEN_STORAGE_KEY = "spawt:push:token";

/** Channel Android des pushes serveur (distinct du channel "guet" local). */
export const PUSH_CHANNEL_ID = "spawt";

let fcmWarned = false;
let channelEnsured = false;
let responseSub: { remove: () => void } | null = null;

/** Channel Android "spawt" pour l'affichage des pushes serveur — idempotent. */
async function ensurePushChannel(): Promise<void> {
  if (channelEnsured) return;
  if (Platform.OS !== "android") {
    channelEnsured = true;
    return;
  }
  try {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: "SPAWT",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
    channelEnsured = true;
  } catch (err) {
    if (__DEV__) console.warn("[push-token] ensurePushChannel failed", err);
  }
}

/**
 * Enregistre le token push Expo du device dans `push_tokens`.
 *
 * Jamais avant le consentement : n'est appelé que quand un spawter onboardé
 * existe (l'écran consent.tsx bloque l'onboarding avant OTP/finalize), et la
 * demande de permission est en plus gated sur `geoloc_consent_at` — même
 * politique ARTCI que le Guet. L'opt-in notifications lui-même reste au
 * niveau OS (Android 13 POST_NOTIFICATIONS déjà déclaré dans app.json).
 *
 * Retourne le token, ou null sur tout chemin dégradé (permission refusée,
 * FCM absent, projectId manquant, web, mode démo) — ne throw JAMAIS.
 */
export async function registerPushToken(): Promise<string | null> {
  // Web : pas de push Expo — l'API n'existe pas dans ce runtime.
  if (Platform.OS === "web") return null;

  const spawter = useSpawterStore.getState().spawter;
  if (!spawter) return null;

  // Permission partagée avec le Guet : si bootGuet l'a déjà obtenue, ce call
  // est un simple getPermissionsAsync (aucun 2e dialogue système).
  const permission = await ensureNotifPermissionPostOTP(
    Boolean(spawter.geoloc_consent_at),
  );
  if (permission !== "granted") return null;

  await ensurePushChannel();

  // projectId depuis la config EAS (app.json extra.eas.projectId) — pas en dur.
  const projectId = (
    Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  )?.eas?.projectId;
  if (!projectId) {
    if (__DEV__) console.warn("[push-token] extra.eas.projectId absent — push serveur désactivé");
    return null;
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (err) {
    // Cas documenté RUNBOOK_SOUMISSION_STORES : Android sans google-services.json
    // (FCM pas configuré côté client) → getExpoPushTokenAsync throw. Dégradation
    // propre : un seul warn, return null, zéro impact sur le reste de l'app.
    if (!fcmWarned) {
      fcmWarned = true;
      console.warn(
        "[push-token] getExpoPushTokenAsync a échoué (FCM/APNs non configuré ?) — push serveur inactif sur ce device",
        err,
      );
    }
    return null;
  }
  if (!token) return null;

  const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
  try {
    // Data layer : upsert `push_tokens` (mode démo = no-op silencieux).
    await upsertPushToken(token, platform);
  } catch (err) {
    // Échec réseau : le token reste mémorisé localement, le prochain boot retentera.
    if (__DEV__) console.warn("[push-token] upsert push_tokens failed", err);
  }
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Best-effort — sans persistance locale, le logout ne pourra juste pas
    // purger la row (elle sera purgée par push-send via DeviceNotRegistered).
  }
  return token;
}

/**
 * Retire le token du device au logout / suppression de compte.
 * À appeler AVANT `supabase.auth.signOut()` : la RLS DELETE de `push_tokens`
 * est owner-only, il faut donc encore une session. Ne throw jamais.
 */
export async function unregisterPushToken(): Promise<void> {
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return;
  }
  if (!token) return;
  try {
    await deletePushToken(token);
  } catch (err) {
    // Row orpheline possible — push-send la purgera (DeviceNotRegistered).
    if (__DEV__) console.warn("[push-token] deletePushToken failed", err);
  }
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // no-op
  }
}

export interface PushNotificationData {
  deep_link?: unknown;
  row_id?: unknown;
  [key: string]: unknown;
}

/**
 * Extrait un chemin interne SÛR depuis `data.deep_link` — null si non-routable.
 * - payload du Guet (row_id présent) → null : laissé au listener guet-notifications.
 * - `spawt://chemin` (scheme app.json) → normalisé en `/chemin`.
 * - Seuls les chemins internes `/…` passent — jamais d'URL web arbitraire.
 */
export function resolvePushDeepLink(
  data: PushNotificationData | null | undefined,
): string | null {
  if (!data) return null;
  if (typeof data.row_id === "string" && data.row_id.length > 0) return null;
  const raw = data.deep_link;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const path = raw.startsWith("spawt://")
    ? `/${raw.slice("spawt://".length).replace(/^\/+/, "")}`
    : raw;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

/**
 * Monte le listener de tap des pushes serveur. À appeler 1× au Root layout
 * (idempotent : re-appel remplace la subscription). Retourne l'unsubscribe.
 */
export function registerPushResponseHandler(): () => void {
  responseSub?.remove();
  responseSub = Notifications.addNotificationResponseReceivedListener((event) => {
    const data = event.notification.request.content.data as PushNotificationData;
    const path = resolvePushDeepLink(data);
    if (!path) return;
    navigateToDeepLink(path);
  });
  return () => {
    responseSub?.remove();
    responseSub = null;
  };
}

/**
 * Navigation avec retry — un tap cold-start peut précéder le mount du Root
 * Stack (même pattern que navigateToReview du guet-orchestrator). RouteGuard
 * redirige si le deep link vise un écran gardé sans spawter.
 */
function navigateToDeepLink(path: string, attempt = 0): void {
  try {
    router.push(path as Href);
  } catch {
    if (attempt >= 20) return;
    setTimeout(() => navigateToDeepLink(path, attempt + 1), 500);
  }
}

/** Test-only : reset l'état module (warn-once, channel, subscription). */
export function _resetPushTokenStateForTest(): void {
  fcmWarned = false;
  channelEnsured = false;
  responseSub?.remove();
  responseSub = null;
}
