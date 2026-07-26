// Helpers purs du cycle de vie abonnement (PRD §11.4 — pas de prélèvement
// automatique en Mobile Money : rappels J-3/J, grâce 7 jours, downgrade).
// Purs = testables en Deno sans mock : toute la logique de dates vit ici,
// les Edge Functions (payment-webhook / payment-cron) ne font que l'appliquer.

import { PLAN_PRICING, type PaidPlan } from "./types.ts";

/** Fenêtre de grâce post-échéance (SPEC 4 §4.5 étape 3 : J+0 → J+7). */
export const GRACE_DAYS = 7;

/** Rappel pré-échéance (SPEC 4 §4.5 étape 1 : push J-3). */
export const RENEWAL_REMINDER_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ajoute N mois calendaires en UTC, jour clampé sur la fin de mois cible
 * (31 janv. + 1 mois → 28/29 févr., pas 3 mars).
 */
export function addMonthsUtc(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  // Jour 0 du mois suivant = dernier jour du mois cible.
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(from.getUTCDate(), lastDayOfTarget);
  return new Date(
    Date.UTC(
      y,
      m,
      day,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/**
 * Échéance d'un plan : +1 mois (gold_monthly, pro, b2b_gold) ou +12 mois
 * (gold_annual). Le cycle rappels/grâce/expiration (decideLifecycle) est
 * IDENTIQUE B2C et B2B — seule la coupure du rôle B2B diffère : elle n'est
 * jamais automatique (acte humain, cf. payment-webhook).
 */
export function computeExpiresAt(plan: PaidPlan, from: Date): Date {
  return addMonthsUtc(from, PLAN_PRICING[plan].months);
}

/**
 * Jours entiers restants avant `target` (floor) — négatif si dépassé.
 * Le cron tourne 1×/jour : daysLeft===3 → rappel J-3, daysLeft===0 → rappel J.
 *
 * floor (et non ceil) : le jour de l'échéance, `target` est encore dans le
 * futur de quelques heures (échéance 12:00, cron 08:00 → +4h). ceil arrondissait
 * ce reste à 1 → le seuil `left===0` du rappel J-0 était INATTEIGNABLE (finding
 * P1#2). floor rend « moins d'un jour restant » = 0, cohérent avec les seuils
 * J-3/J-0, tout en gardant les multiples exacts de 24 h (72h→3, 0h→0, passé→<0).
 */
export function daysUntil(now: Date, target: Date): number {
  return Math.floor((target.getTime() - now.getTime()) / DAY_MS);
}

export type LifecycleAction =
  | { kind: "remind_j3" }
  | { kind: "remind_j0" }
  | { kind: "to_grace"; grace_until: string }
  | { kind: "to_expired" }
  | { kind: "none" };

/**
 * Décision de cycle de vie pour UNE subscription (statuts schéma 0032).
 *   active + échéance à J-3 / J          → rappel push
 *   active + échéance dépassée           → grace (grace_until = échéance + 7 j)
 *   grace  + grace_until dépassé         → expired
 */
export function decideLifecycle(input: {
  status: string;
  expires_at: string | null;
  grace_until: string | null;
  now: Date;
}): LifecycleAction {
  const { status, now } = input;
  const expiresAt = input.expires_at ? new Date(input.expires_at) : null;
  const graceUntil = input.grace_until ? new Date(input.grace_until) : null;

  if (status === "active" && expiresAt) {
    if (expiresAt.getTime() <= now.getTime()) {
      return {
        kind: "to_grace",
        grace_until: addDays(expiresAt, GRACE_DAYS).toISOString(),
      };
    }
    const left = daysUntil(now, expiresAt);
    if (left === RENEWAL_REMINDER_DAYS) return { kind: "remind_j3" };
    if (left === 0) return { kind: "remind_j0" };
    return { kind: "none" };
  }

  if (status === "grace") {
    // grace_until absent (donnée incohérente) → on expire aussi : la grâce
    // sans borne serait un Gold gratuit à vie.
    if (!graceUntil || graceUntil.getTime() <= now.getTime()) {
      return { kind: "to_expired" };
    }
    return { kind: "none" };
  }

  return { kind: "none" };
}
