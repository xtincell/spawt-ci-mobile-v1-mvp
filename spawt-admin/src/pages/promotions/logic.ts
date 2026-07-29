// Console admin 07/2026 — logique pure de la page Promotions (testable sans
// Refine). Table place_promotions (migration 0050).
//
// ⚠️ CONTRAT SPAWT : une promotion est un AFFICHAGE ÉTIQUETÉ — elle n'entre
// JAMAIS dans le calcul de la note d'un lieu ni dans le score de matching.
// Le bandeau CONTRAT_PROMO_TEXT est affiché en permanence sur la page pour
// que personne côté équipe ne l'oublie (et testé : garde anti-régression).

/** Texte du bandeau Contrat — affiché sur la page, vérifié par les tests. */
export const CONTRAT_PROMO_TEXT =
  "Contrat SPAWT : une promotion est un affichage étiqueté — " +
  "elle n'affecte jamais la note d'un lieu ni le classement du matching. " +
  "Un lieu ne peut pas acheter sa visibilité algorithmique.";

export interface PlacePromotionRow {
  id: string;
  place_id: string;
  label: string;
  description: string | null;
  /** Date civile YYYY-MM-DD, NULL = sans borne. */
  starts_at: string | null;
  ends_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  places?: { name: string } | null;
}

export type PromoState = "active" | "inactive" | "all";

/**
 * Une promotion est active si publiée ET la fenêtre de dates couvre `today`
 * (YYYY-MM-DD) — même sémantique que la policy RLS 0050 (bornes NULL = fenêtre
 * ouverte de ce côté). Comparaison lexicale : les dates ISO trient comme des
 * chaînes.
 */
export function isPromoActive(
  row: Pick<PlacePromotionRow, "is_published" | "starts_at" | "ends_at">,
  today: string,
): boolean {
  if (!row.is_published) return false;
  if (row.starts_at && row.starts_at > today) return false;
  if (row.ends_at && row.ends_at < today) return false;
  return true;
}

/** Filtre lieu + état (pure). */
export function filterPromotions(
  rows: PlacePromotionRow[],
  placeId: string | "all",
  state: PromoState,
  today: string,
): PlacePromotionRow[] {
  return rows.filter((r) => {
    if (placeId !== "all" && r.place_id !== placeId) return false;
    if (state === "active") return isPromoActive(r, today);
    if (state === "inactive") return !isPromoActive(r, today);
    return true;
  });
}

/** Aujourd'hui en date civile locale (YYYY-MM-DD). */
export function todayIsoDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ── Validation formulaire ───────────────────────────────────────────────────

export interface PromoFormValues {
  place_id: string;
  label: string;
  description: string;
  /** YYYY-MM-DD ou vide (sans borne). */
  starts_at: string;
  ends_at: string;
  is_published: boolean;
}

export const EMPTY_PROMO_FORM: PromoFormValues = {
  place_id: "",
  label: "",
  description: "",
  starts_at: "",
  ends_at: "",
  is_published: false,
};

export interface PromoDbRow {
  place_id: string;
  label: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_published: boolean;
}

export type PromoValidation =
  | { ok: true; row: PromoDbRow }
  | { ok: false; errors: string[] };

/** Miroir client des CHECKs 0050 (label non vide, ends_at >= starts_at). */
export function validatePromoForm(v: PromoFormValues): PromoValidation {
  const errors: string[] = [];
  if (!v.place_id) errors.push("Choisis le lieu concerné.");
  if (v.label.trim().length === 0) errors.push("Le libellé est obligatoire.");
  if (v.starts_at && v.ends_at && v.ends_at < v.starts_at) {
    errors.push("La fin ne peut pas précéder le début.");
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    row: {
      place_id: v.place_id,
      label: v.label.trim(),
      description: v.description.trim() || null,
      starts_at: v.starts_at || null,
      ends_at: v.ends_at || null,
      is_published: v.is_published,
    },
  };
}

/** Row DB → valeurs formulaire (édition). */
export function promoRowToForm(row: PlacePromotionRow): PromoFormValues {
  return {
    place_id: row.place_id,
    label: row.label,
    description: row.description ?? "",
    starts_at: row.starts_at ?? "",
    ends_at: row.ends_at ?? "",
    is_published: row.is_published,
  };
}
