// Câblage MVP — Orchestrateur du Guet (le chef d'orchestre qui manquait).
//
// Les primitives (geofence, notifications, actions, queue offline) existaient
// et étaient testées, mais rien ne les connectait : `armGuet()` n'était appelé
// nulle part (Story 4.2 §PASS 2 jamais livré). Ce module ferme la boucle :
//
//   bootGuet (post-onboarding / app active)
//     ├─ hydrate feature flags + finalise les rows pending périmées
//     ├─ branche guet-task (lookup noms + callback enter/exit)
//     ├─ monte le handler de réponses notification (confirm/snooze/tap)
//     ├─ permission notifications (gated consent géoloc — ARTCI)
//     └─ armGuet sur les lieux les plus proches (cap 20 — limite iOS)
//
//   ENTER zone  → row pending + notif locale schedulée à +15min (survit OS-kill)
//   EXIT zone   → <15min : annule tout (pas de spawt) ; ≥15min : left_at posé,
//                 fenêtre +30min ouverte
//   Réponse notif → confirm/tap : computeConfirmPatch → registerSpawt → modal avis
//                 → snooze : computeSnoozePatch, re-schedule (cap 3 puis passif)
//   Fenêtre +30min écoulée sans réponse → spawt passif (poids 0.5x) au prochain
//                 foreground (finalizeStalePending — pas de tâche background JS).
//
// Dégradés : mode démo → armGuet no-op ; permission refusée → spawt manuel
// uniquement (aucun nag) ; Expo Go → pas de geofencing background (documenté).

import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router } from "expo-router";

import { listPlaces } from "../data-source";
import { useSpawterStore } from "../../store/spawter-store";
import { useFeatureFlagsStore } from "../../store/feature-flags";
import { ANTIFRAUD_RULES, type SpawtCheckin } from "../../types/spawt";
import { track } from "../analytics";
import { saveSpawtToSupabaseOrEnqueue } from "../offline-queue";
import { armGuet, disarmGuet, type ArmablePlace } from "./geofence";
import {
  registerGeofenceCallback,
  setPlaceNameLookup,
  type GeofenceEventType,
} from "./guet-task";
import {
  scheduleGuetPrompt,
  cancelGuetPrompt,
  cancelAllGuetNotifications,
  registerNotificationResponseHandler,
  type GuetPromptPayload,
} from "./guet-notifications";
import { ensureNotifPermissionPostOTP } from "./guet-permissions";
import {
  buildPendingSpawt,
  computeConfirmPatch,
  computePassivePatch,
  computeSnoozePatch,
} from "./guet-spawt-actions";
import {
  findOpenPendingByPlace,
  getPending,
  listPending,
  patchPending,
  removePending,
  upsertPending,
} from "./guet-pending";

const PRESENCE_MS = ANTIFRAUD_RULES.PRESENCE_THRESHOLD_MINUTES * 60_000;
const PRESENCE_SECONDS = ANTIFRAUD_RULES.PRESENCE_THRESHOLD_MINUTES * 60;
const WINDOW_MS = ANTIFRAUD_RULES.POST_LEAVE_WINDOW_MINUTES * 60_000;
/** Row jamais sortie de zone depuis >24h = artefact (app tuée hors zone) — abandon. */
const STALE_MS = 24 * 60 * 60_000;
/** Throttle du re-arm au foreground — le set de lieux proches bouge lentement. */
const REARM_MIN_INTERVAL_MS = 5 * 60_000;
/** Opt-out device-level du Guet (écran Paramètres) — persiste au relaunch. */
const GUET_OPTOUT_KEY = "spawt:guet:optout";

let booted = false;
let unsubNotif: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;
let lastArmAt = 0;
const placeNames = new Map<string, string>();

/**
 * Point d'entrée — appelé au Root layout dès qu'un spawter onboardé existe.
 * Idempotent (re-appel = no-op). Ne demande JAMAIS la permission localisation
 * sans consent géoloc posé (ARTCI set-once) — armGuet fait ce gating lui-même.
 */
export async function bootGuet(): Promise<void> {
  if (booted) return;
  if (await isGuetOptedOut()) return;
  booted = true;

  const spawter = useSpawterStore.getState().spawter;

  // Feature flags — best-effort : le fallback __DEV__ de geofence.ts couvre
  // l'échec réseau ; on n'empêche jamais le boot pour un fetch de flags.
  try {
    await useFeatureFlagsStore.getState().hydrate(spawter?.id ?? null);
  } catch (err) {
    if (__DEV__) console.info("[guet-orchestrator] flags hydrate failed", err);
  }

  await finalizeStalePending();

  setPlaceNameLookup((place_id) => placeNames.get(place_id) ?? null);
  registerGeofenceCallback((type, place) => {
    void handleGeofenceEvent(type, place);
  });
  unsubNotif = registerNotificationResponseHandler(handleNotifResponse);

  await ensureNotifPermissionPostOTP(Boolean(spawter?.geoloc_consent_at));
  await rearmGuet({ force: true });

  appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state !== "active") return;
    void (async () => {
      await finalizeStalePending();
      await rearmGuet({ force: false });
    })();
  });
}

/** Logout / opt-out : désarme tout et débranche les listeners. */
export async function shutdownGuet(): Promise<void> {
  if (!booted) return;
  booted = false;
  unsubNotif?.();
  unsubNotif = null;
  appStateSub?.remove();
  appStateSub = null;
  registerGeofenceCallback(null);
  await disarmGuet();
  await cancelAllGuetNotifications();
}

/**
 * (Ré)arme les geofences sur les lieux connus, les plus proches d'abord si une
 * position est disponible. Les no-op de armGuet (démo, consent, flag, perm)
 * s'appliquent — on ne re-teste pas ici.
 */
export async function rearmGuet(options: { force: boolean }): Promise<void> {
  const now = Date.now();
  if (!options.force && now - lastArmAt < REARM_MIN_INTERVAL_MS) return;

  const spawter = useSpawterStore.getState().spawter;
  if (!spawter) return;

  let places: Awaited<ReturnType<typeof listPlaces>>;
  try {
    places = await listPlaces();
  } catch (err) {
    if (__DEV__) console.warn("[guet-orchestrator] listPlaces failed", err);
    return;
  }

  const armables: ArmablePlace[] = [];
  for (const p of places) {
    placeNames.set(p.id, p.name);
    if (p.location?.lat != null && p.location?.lng != null) {
      armables.push({ id: p.id, lat: p.location.lat, lng: p.location.lng });
    }
  }
  if (armables.length === 0) return;

  // Position courante best-effort — SANS demande de permission (armGuet gère
  // la demande, gated consent). lastKnown = zéro coût batterie.
  let position: { lat: number; lng: number } | undefined;
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status === "granted") {
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        position = { lat: last.coords.latitude, lng: last.coords.longitude };
      }
    }
  } catch {
    // Position indisponible — armGuet prendra les 20 premiers lieux.
  }

  await armGuet(armables, {
    hasGeolocConsent: Boolean(spawter.geoloc_consent_at),
    ...(position ? { spawter: position } : {}),
  });
  lastArmAt = now;
}

/** ENTER/EXIT geofence — invoqué par guet-task (background inclus). */
export async function handleGeofenceEvent(
  type: GeofenceEventType,
  place: { id: string; name: string },
): Promise<void> {
  const spawter = useSpawterStore.getState().spawter;
  if (!spawter) return;
  const now = new Date();

  if (type === "enter") {
    const existing = await findOpenPendingByPlace(place.id);
    if (existing) return; // déjà en zone — event dupliqué OS

    const row = buildPendingSpawt(spawter.id, place.id, now);
    const scheduled = await scheduleGuetPrompt(
      { row_id: row.id, place_id: place.id, place_name: place.name },
      PRESENCE_SECONDS,
    );
    if (scheduled) {
      row.notified_at = new Date(now.getTime() + PRESENCE_MS).toISOString();
    }
    await upsertPending(row);
    track({
      name: "guet_geofence_triggered",
      properties: { place_id: place.id, row_id: row.id, direction: "enter" },
    });
    if (scheduled) {
      track({
        name: "guet_notification_sent",
        properties: { place_id: place.id, row_id: row.id },
      });
    }
    return;
  }

  // EXIT
  const row = await findOpenPendingByPlace(place.id);
  if (!row) return;
  const elapsed = now.getTime() - new Date(row.arrived_at).getTime();

  if (elapsed < PRESENCE_MS) {
    // Passage éclair (<15min) : pas de spawt — anti-fraude PRD §7.1.
    await cancelGuetPrompt(row.id);
    await removePending(row.id);
    track({
      name: "spawt_cancelled",
      properties: {
        place_id: place.id,
        reason: "left_before_threshold",
        elapsed_minutes: Math.round(elapsed / 60_000),
      },
    });
    return;
  }

  await patchPending(row.id, {
    left_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  track({
    name: "guet_geofence_triggered",
    properties: {
      place_id: place.id,
      direction: "exit",
      elapsed_minutes: Math.round(elapsed / 60_000),
    },
  });
}

/** Réponse à la notif "Le Guet a sonné" (confirm / snooze / tap corps). */
export async function handleNotifResponse(
  action: "confirm" | "snooze" | "default",
  payload: GuetPromptPayload,
): Promise<void> {
  const row = await getPending(payload.row_id);
  if (!row || row.checked_in_at !== null) return;
  const now = new Date();

  if (action === "snooze") {
    const { patch, can_reschedule } = computeSnoozePatch(row, now);
    const updated = (await patchPending(row.id, patch)) ?? { ...row, ...patch };
    if (can_reschedule) {
      await scheduleGuetPrompt(
        {
          row_id: row.id,
          place_id: row.place_id,
          place_name: placeNames.get(row.place_id) ?? payload.place_name,
        },
        PRESENCE_SECONDS,
      );
      track({ name: "spawt_snoozed", properties: { row_id: row.id, count: updated.snooze_count } });
    } else {
      await finalizePassiveRow(updated, now);
    }
    return;
  }

  // confirm / default (tap) — cold-start possible : attendre l'hydratation du
  // store avant registerSpawt (sinon recompute stade sur état vide).
  await waitForSpawterHydration();
  const { patch } = computeConfirmPatch(row, "active", {}, now);
  const final: SpawtCheckin = { ...row, ...patch };
  await removePending(row.id);
  await useSpawterStore.getState().registerSpawt(final);
  void saveSpawtToSupabaseOrEnqueue({ kind: "spawt_insert", row: final });
  track({
    name: "spawt_notification_opened",
    properties: { row_id: row.id, place_id: row.place_id, action },
  });
  navigateToReview(final.id);
}

/**
 * Ferme les rows pending périmées. Appelé au boot + à chaque retour foreground
 * (pas de timer background JS — D-409 : le scheduler OS ne réveille que via
 * notification, la finalisation passive attend donc le prochain foreground).
 */
export async function finalizeStalePending(now: Date = new Date()): Promise<void> {
  const rows = await listPending();
  for (const row of rows) {
    if (row.checked_in_at !== null) {
      await removePending(row.id); // déjà fermée — reliquat
      continue;
    }
    if (row.left_at !== null) {
      const sinceLeft = now.getTime() - new Date(row.left_at).getTime();
      if (sinceLeft >= WINDOW_MS) await finalizePassiveRow(row, now);
      continue;
    }
    const sinceArrived = now.getTime() - new Date(row.arrived_at).getTime();
    if (sinceArrived >= STALE_MS) {
      await cancelGuetPrompt(row.id);
      await removePending(row.id);
      track({ name: "spawt_cancelled", properties: { row_id: row.id, reason: "stale_pending" } });
    }
  }
}

async function finalizePassiveRow(row: SpawtCheckin, now: Date): Promise<void> {
  const patch = computePassivePatch(row, now);
  const final: SpawtCheckin = { ...row, ...patch };
  await cancelGuetPrompt(row.id);
  await removePending(row.id);
  await waitForSpawterHydration();
  await useSpawterStore.getState().registerSpawt(final);
  void saveSpawtToSupabaseOrEnqueue({ kind: "spawt_insert", row: final });
  track({
    name: "spawt_passive_recorded",
    properties: { row_id: row.id, place_id: row.place_id },
  });
}

/** Attend la fin d'hydratation du spawter-store (cold-start via tap notif). */
async function waitForSpawterHydration(timeoutMs = 10_000): Promise<void> {
  const store = useSpawterStore;
  if (!store.getState().hydrating) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve();
    }, timeoutMs);
    const unsub = store.subscribe((state) => {
      if (!state.hydrating) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });
}

/**
 * Navigation vers le modal d'avis — retry car un tap de notif cold-start peut
 * arriver avant le mount du Root Stack (Story 4.2 Risque #4).
 */
function navigateToReview(spawt_id: string, attempt = 0): void {
  try {
    router.push(`/review/${spawt_id}`);
  } catch {
    if (attempt >= 20) return;
    setTimeout(() => navigateToReview(spawt_id, attempt + 1), 500);
  }
}

/** Opt-out device-level (Paramètres) : true = Le Guet ne s'arme plus. */
export async function isGuetOptedOut(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GUET_OPTOUT_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setGuetOptOut(optOut: boolean): Promise<void> {
  try {
    if (optOut) {
      await AsyncStorage.setItem(GUET_OPTOUT_KEY, "1");
      await shutdownGuet();
    } else {
      await AsyncStorage.removeItem(GUET_OPTOUT_KEY);
      await bootGuet();
    }
  } catch (err) {
    if (__DEV__) console.warn("[guet-orchestrator] setGuetOptOut failed", err);
  }
}

/** Test-only : reset l'état module. */
export function _resetOrchestratorForTest(): void {
  booted = false;
  unsubNotif?.();
  unsubNotif = null;
  appStateSub?.remove();
  appStateSub = null;
  lastArmAt = 0;
  placeNames.clear();
}
