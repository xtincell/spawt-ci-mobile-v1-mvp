// Console admin 07/2026 — logique pure de la page Événements (testable sans
// Refine, pattern signalements/logic.ts). Table place_events (migration 0049).
//
// Sémantique « à venir » alignée sur la policy RLS place_events_select_published :
// un événement est d'actualité tant que coalesce(ends_at, starts_at) >= now
// (à venir OU en cours). Passé = tout le reste.

export interface PlaceEventRow {
  id: string;
  place_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  image_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  places?: { name: string } | null;
}

export type EventTense = "upcoming" | "past" | "all";

/** Un événement est-il encore d'actualité (à venir ou en cours) ? */
export function isUpcoming(
  row: Pick<PlaceEventRow, "starts_at" | "ends_at">,
  now: Date = new Date(),
): boolean {
  const horizon = row.ends_at ?? row.starts_at;
  return new Date(horizon).getTime() >= now.getTime();
}

/** Filtre lieu + temporalité (pure — l'état UI pilote, pas de re-query). */
export function filterEvents(
  rows: PlaceEventRow[],
  placeId: string | "all",
  tense: EventTense,
  now: Date = new Date(),
): PlaceEventRow[] {
  return rows.filter((r) => {
    if (placeId !== "all" && r.place_id !== placeId) return false;
    if (tense === "upcoming") return isUpcoming(r, now);
    if (tense === "past") return !isUpcoming(r, now);
    return true;
  });
}

// ── Conversions datetime-local ↔ ISO ────────────────────────────────────────
// <input type="datetime-local"> parle en heure locale « YYYY-MM-DDTHH:mm » ;
// la DB parle timestamptz ISO. Round-trip garanti à la minute près.

export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value); // interprété en heure locale (spec datetime-local)
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ── Validation formulaire ───────────────────────────────────────────────────

export interface EventFormValues {
  place_id: string;
  title: string;
  description: string;
  /** Format datetime-local (heure locale). */
  starts_at: string;
  /** Format datetime-local, vide = sans fin déclarée. */
  ends_at: string;
  image_url: string;
  is_published: boolean;
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  place_id: "",
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  image_url: "",
  is_published: false,
};

export interface EventDbRow {
  place_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  image_url: string | null;
  is_published: boolean;
}

export type EventValidation =
  | { ok: true; row: EventDbRow }
  | { ok: false; errors: string[] };

/** Miroir client des CHECKs 0049 (title non vide, ends_at >= starts_at). */
export function validateEventForm(v: EventFormValues): EventValidation {
  const errors: string[] = [];
  if (!v.place_id) errors.push("Choisis le lieu concerné.");
  if (v.title.trim().length === 0) errors.push("Le titre est obligatoire.");
  const startsIso = fromDatetimeLocal(v.starts_at);
  if (!startsIso) errors.push("La date de début est obligatoire.");
  const endsIso = v.ends_at ? fromDatetimeLocal(v.ends_at) : null;
  if (v.ends_at && !endsIso) errors.push("Date de fin invalide.");
  if (startsIso && endsIso && new Date(endsIso) < new Date(startsIso)) {
    errors.push("La fin ne peut pas précéder le début.");
  }
  if (v.image_url && !/^https?:\/\//.test(v.image_url.trim())) {
    errors.push("L'URL de l'image doit commencer par http(s)://");
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    row: {
      place_id: v.place_id,
      title: v.title.trim(),
      description: v.description.trim() || null,
      starts_at: startsIso as string,
      ends_at: endsIso,
      image_url: v.image_url.trim() || null,
      is_published: v.is_published,
    },
  };
}

/** Row DB → valeurs formulaire (édition). */
export function eventRowToForm(row: PlaceEventRow): EventFormValues {
  return {
    place_id: row.place_id,
    title: row.title,
    description: row.description ?? "",
    starts_at: toDatetimeLocal(row.starts_at),
    ends_at: row.ends_at ? toDatetimeLocal(row.ends_at) : "",
    image_url: row.image_url ?? "",
    is_published: row.is_published,
  };
}
