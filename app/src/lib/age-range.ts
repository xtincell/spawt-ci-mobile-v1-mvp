// Story 4.8 — Refactor date_of_birth dynamique (Epic 4 PASS 2)
//
// Helper pur : convertit une date de naissance ISO en `AgeRange` bucketé.
// Préserve l'invariant analytics (Madame Sun consomme `age_range` only, jamais
// `date_of_birth` brut). Si âge < 13 → null (refus onboarding, RGPD-équivalent
// CIV).
//
// Format input : 'YYYY-MM-DD'. Toute autre forme → null.

import type { AgeRange } from "../types/spawter";

export type ISODateString = string;

/**
 * Calcule l'âge en années pleines depuis une date ISO et le mappe sur le bucket
 * `AgeRange` correspondant. Retourne `null` si :
 *   - le format est invalide
 *   - l'âge calculé est < 13 ans (refus onboarding)
 */
export function ageRangeFromDateOfBirth(
  dob: ISODateString,
  today: Date = new Date(),
): AgeRange | null {
  const parts = dob.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return null;

  let age = today.getFullYear() - y;
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  // Si l'anniversaire n'est pas encore passé cette année → âge - 1.
  if (todayMonth < m || (todayMonth === m && todayDay < d)) {
    age -= 1;
  }

  if (age < 13) return null;
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 54) return "45-54";
  return "55+";
}

/**
 * Helper Chat — true si le `dob` tombe sur le jour/mois du `today`.
 * Utilisé par la voix du Chat pour souhaiter un anniversaire (voir PRD §15).
 */
export function isBirthdayToday(
  dob: ISODateString,
  today: Date = new Date(),
): boolean {
  const parts = dob.split("-");
  if (parts.length !== 3) return false;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(m) || !Number.isFinite(d)) return false;
  return today.getMonth() + 1 === m && today.getDate() === d;
}
