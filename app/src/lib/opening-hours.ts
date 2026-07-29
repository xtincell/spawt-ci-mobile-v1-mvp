// R20 (MAJ consolidée 07/2026) — priorité aux lieux OUVERTS dans le feed.
// Logique pure d'horaires : un lieu est « ouvert maintenant » si l'heure
// courante tombe dans un créneau du jour, en gérant les créneaux qui passent
// minuit (ex. 19:00–02:00 : ouvert à 01:00 grâce au créneau de la veille).
// Prolonge R12 (affichage horaires 7 jours, cf. OpeningHours.tsx).

import type { DayOfWeek, OpeningSlot } from "../types/place";

const JS_DAY_TO_KEY: readonly DayOfWeek[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/** "HH:mm" → minutes depuis minuit ; null si le format dévie du schéma. */
function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function dayKeyAt(now: Date, offsetDays: number): DayOfWeek {
  // getDay() est en fuseau local — cohérent avec l'usage terrain (Abidjan).
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  return JS_DAY_TO_KEY[d.getDay()] ?? "mon";
}

/**
 * Vrai si `now` tombe dans un créneau d'ouverture.
 * - Créneau simple (open < close) : open ≤ t < close.
 * - Créneau nocturne (open > close, passe minuit) : t ≥ open aujourd'hui,
 *   OU t < close via le créneau de la VEILLE.
 * - Créneau dégénéré (open === close) : ignoré (durée nulle).
 * - Données absentes/malformées : considéré fermé (fail-closed, le feed
 *   rétrograde sans crasher).
 */
export function isOpenAt(
  hours: Partial<Record<DayOfWeek, OpeningSlot[]>> | null | undefined,
  now: Date,
): boolean {
  if (!hours) return false;
  const t = now.getHours() * 60 + now.getMinutes();

  const todaySlots = hours[dayKeyAt(now, 0)] ?? [];
  for (const slot of todaySlots) {
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close);
    if (open === null || close === null || open === close) continue;
    if (open < close) {
      if (t >= open && t < close) return true;
    } else if (t >= open) {
      // Nocturne : ouvert de `open` jusqu'à minuit aujourd'hui.
      return true;
    }
  }

  // Queue de créneau nocturne de la veille (ex. sam 23:00–03:00 → dim 01:00).
  const yesterdaySlots = hours[dayKeyAt(now, -1)] ?? [];
  for (const slot of yesterdaySlots) {
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close);
    if (open === null || close === null || open === close) continue;
    if (open > close && t < close) return true;
  }

  return false;
}

/**
 * Réordonne une liste classée : les items OUVERTS d'abord, l'ordre relatif
 * (le classement match) étant préservé dans chaque groupe (tri stable ES2019).
 */
export function partitionOpenFirst<T>(
  items: readonly T[],
  getHours: (item: T) => Partial<Record<DayOfWeek, OpeningSlot[]>> | null | undefined,
  now: Date,
): T[] {
  const openNow = new Map<T, boolean>();
  for (const item of items) openNow.set(item, isOpenAt(getHours(item), now));
  return [...items].sort(
    (a, b) => Number(openNow.get(b) ?? false) - Number(openNow.get(a) ?? false),
  );
}
