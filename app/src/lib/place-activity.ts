// Événements & promotions de lieux (migrations 0049 + 0050) — types + helpers purs.
//
// ⚠️ CONTRAT SPAWT (non négociable) : une promotion est un AFFICHAGE ÉTIQUETÉ
// — un badge « PROMO » sur la fiche lieu et une pastille discrète sur le feed,
// RIEN DE PLUS. Elle n'entre JAMAIS dans le calcul de la note d'un lieu
// (weighted-rating.ts) ni dans le score de matching (matching.ts) : aucun
// poids, aucun bonus, aucun import croisé. Un lieu ne peut pas acheter sa
// visibilité algorithmique — les avis appartiennent à la Meute. Un test-garde
// (matching-promo-guard.test.ts) vérifie statiquement cette étanchéité.
//
// Moteur pur, total (no throw), sans I/O — les filtres MIROIRS des policies
// RLS (0049 : publié + à venir/en cours ; 0050 : publiée + fenêtre civile
// ouverte) servent au mode démo ET aux tests de parité.

/** Événement ponctuel d'un lieu (table place_events, 0049). */
export interface PlaceEvent {
  id: string;
  place_id: string;
  title: string;
  description: string | null;
  /** timestamptz ISO — début de l'événement. */
  starts_at: string;
  /** timestamptz ISO ou null (événement sans fin annoncée). */
  ends_at: string | null;
  image_url: string | null;
}

/** Promotion d'un lieu (table place_promotions, 0050) — affichage étiqueté. */
export interface PlacePromotion {
  id: string;
  place_id: string;
  label: string;
  description: string | null;
  /** Date civile `YYYY-MM-DD` ou null (« du 10 au 15 », pas à l'heure près). */
  starts_at: string | null;
  ends_at: string | null;
}

/** Événement à venir joint au lieu (rangée « Ça bouge cette semaine »). */
export interface UpcomingEvent extends PlaceEvent {
  place_name: string;
  place_neighborhood: string;
}

/** Pastilles feed d'un lieu — dérivées par lot, jamais un fetch par carte. */
export interface PlaceActivityFlags {
  has_event: boolean;
  has_promo: boolean;
}

/** place_id → pastilles. Un lieu absent = aucune activité en cours. */
export type PlaceActivityMap = Record<string, PlaceActivityFlags>;

/**
 * Miroir de la policy RLS `place_events_select_published` (0049) :
 * `coalesce(ends_at, starts_at) >= now()` — à venir OU en cours.
 * Timestamp illisible → false (on n'affiche pas ce qu'on ne sait pas dater).
 */
export function isEventCurrent(
  event: Pick<PlaceEvent, "starts_at" | "ends_at">,
  now: Date,
): boolean {
  const edge = new Date(event.ends_at ?? event.starts_at).getTime();
  if (!Number.isFinite(edge)) return false;
  return edge >= now.getTime();
}

/**
 * Fenêtre « cette semaine » de la rangée feed : événement encore d'actualité
 * ET qui démarre dans les 7 prochains jours (ou déjà en cours).
 */
export function isEventThisWeek(
  event: Pick<PlaceEvent, "starts_at" | "ends_at">,
  now: Date,
): boolean {
  if (!isEventCurrent(event, now)) return false;
  const starts = new Date(event.starts_at).getTime();
  if (!Number.isFinite(starts)) return false;
  const weekAhead = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  return starts <= weekAhead;
}

/** Date civile locale `YYYY-MM-DD` — même granularité que les colonnes 0050. */
export function todayCivilDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Miroir de la policy RLS `place_promotions_select_published` (0050) :
 * fenêtre civile ouverte, borne absente = pas de contrainte de ce côté.
 * Comparaison lexicographique — valide pour le format `YYYY-MM-DD`.
 */
export function isPromoActive(
  promo: Pick<PlacePromotion, "starts_at" | "ends_at">,
  todayCivil: string,
): boolean {
  if (promo.starts_at !== null && promo.starts_at > todayCivil) return false;
  if (promo.ends_at !== null && promo.ends_at < todayCivil) return false;
  return true;
}

/**
 * Date d'événement formatée FR (« ven. 31 juil. · 20:00 »). Timestamp
 * illisible → "" (le caller n'affiche alors pas de ligne date).
 */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const day = d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

/**
 * Date civile 0050 formatée FR (« 10 juil. »). Parse à midi UTC : une date
 * civile n'a pas d'heure, on évite qu'un fuseau négatif la fasse glisser
 * d'un jour à l'affichage.
 */
export function formatCivilDate(civil: string): string {
  const d = new Date(`${civil}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
