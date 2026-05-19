// Story 4.2 — Helpers de confirmation/snooze/passive/manual sur spawt_checkin.
//
// Pattern :
//  - confirmSpawt(row, "active") — tap notif "Confirmer" : checked_in_at, type, is_verified, latency <500ms.
//  - scheduleSnooze(row) — re-schedule notif 15min plus tard, snooze_count++.
//  - finalizePassive(row) — fin de fenêtre +30min, passive enregistré.
//  - registerSpawtManual(place_id) — mode démo CTA fiche lieu.
//
// Tous les helpers retournent une `SpawtCheckin` patched. La persistance
// (AsyncStorage + Supabase via wrapper Story 4.3) est faite par `spawter-store`.

import * as Crypto from "expo-crypto";

import { ANTIFRAUD_RULES, type SpawtCheckin, type CheckInType } from "../../types/spawt";

export interface GpsMeasurement {
  /** Précision GPS (NFR-GEO-02 : > 30m → manual). */
  accuracy_meters?: number | null;
  /** Niveau batterie en pourcentage (NFR-GEO-04 : < 10 → passive forcé). */
  battery_percent?: number | null;
}

export interface ConfirmResult {
  patch: Partial<SpawtCheckin>;
  next_type: CheckInType;
  is_verified: boolean;
  forced_passive: boolean;
}

/**
 * Calcule le patch de confirmation d'une row pending.
 * Pure helper — exposé pour tests + cohérence local-first / fire-and-forget Supabase.
 */
export function computeConfirmPatch(
  row: Pick<SpawtCheckin, "arrived_at">,
  requestedType: CheckInType,
  measurements: GpsMeasurement = {},
  now: Date = new Date(),
): ConfirmResult {
  const accuracy = measurements.accuracy_meters ?? null;
  const battery = measurements.battery_percent ?? null;

  // NFR-GEO-04 — batterie < 10% force passive (skip notif côté schedule, ici defensive).
  const forcedPassive = battery !== null && battery < 10 && requestedType === "active";
  const next_type: CheckInType = forcedPassive ? "passive" : requestedType;

  // NFR-GEO-02 — précision > 30m → bascule manual (is_verified = false).
  const accuracyKo = accuracy !== null && accuracy > 30;
  const effective_type: CheckInType =
    next_type === "active" && accuracyKo ? "manual" : next_type;
  const is_verified =
    effective_type === "active"
      ? accuracy === null || accuracy <= 30
      : false;

  const arrived = new Date(row.arrived_at).getTime();
  const session_minutes = Math.max(
    0,
    Math.round((now.getTime() - arrived) / 60_000),
  );

  return {
    patch: {
      checked_in_at: now.toISOString(),
      check_in_type: effective_type,
      session_duration_minutes: session_minutes,
      is_verified,
      ...(effective_type === "manual" ? { geolocation_source: "manual" as const } : {}),
      ...(accuracy !== null ? { accuracy_meters: accuracy } : {}),
      updated_at: now.toISOString(),
    },
    next_type: effective_type,
    is_verified,
    forced_passive: forcedPassive,
  };
}

/** Snooze : retourne la row patched + le nouveau snooze_count, capped à 3. */
export function computeSnoozePatch(
  row: Pick<SpawtCheckin, "snooze_count">,
  now: Date = new Date(),
): { patch: Partial<SpawtCheckin>; new_count: number; can_reschedule: boolean } {
  const new_count = Math.min(
    row.snooze_count + 1,
    ANTIFRAUD_RULES.MAX_SNOOZE_COUNT,
  );
  return {
    patch: {
      snoozed_at: now.toISOString(),
      snooze_count: new_count,
      updated_at: now.toISOString(),
    },
    new_count,
    can_reschedule: new_count < ANTIFRAUD_RULES.MAX_SNOOZE_COUNT,
  };
}

/** Finalise une row pending en passive (fenêtre +30min écoulée sans confirm). */
export function computePassivePatch(
  row: Pick<SpawtCheckin, "arrived_at" | "left_at" | "is_verified">,
  now: Date = new Date(),
): Partial<SpawtCheckin> {
  const arrived = new Date(row.arrived_at).getTime();
  const session_minutes = Math.max(
    0,
    Math.round((now.getTime() - arrived) / 60_000),
  );
  return {
    checked_in_at: now.toISOString(),
    check_in_type: "passive" as const,
    session_duration_minutes: session_minutes,
    // is_verified passive : préserve la valeur initiale (déjà calculée à l'entrée
    // côté guet-task). Pas de re-validation.
    is_verified: row.is_verified,
    updated_at: now.toISOString(),
  };
}

/**
 * Mode démo (Expo Go / fallback) — crée une row SpawtCheckin manuelle complète
 * (pas pending — directement closed). Pas de Supabase, store local-first.
 */
export function buildManualSpawt(
  spawter_id: string,
  place_id: string,
  place_lat: number,
  place_lng: number,
): SpawtCheckin {
  const now = new Date().toISOString();
  return {
    id: Crypto.randomUUID(),
    spawter_id,
    place_id,
    arrived_at: now,
    notified_at: null,
    snoozed_at: null,
    snooze_count: 0,
    checked_in_at: now,
    left_at: null,
    check_in_type: "manual",
    session_duration_minutes: null,
    geolocation_lat: place_lat,
    geolocation_lng: place_lng,
    accuracy_meters: null,
    geolocation_source: "manual",
    distance_to_lieu_meters: null,
    is_verified: false,
    flag_reason: null,
    note_etoiles: null,
    texte_avis: null,
    tags: [],
    photos: [],
    is_cancelled: false,
    is_seed: false,
    created_at: now,
    updated_at: now,
  };
}
