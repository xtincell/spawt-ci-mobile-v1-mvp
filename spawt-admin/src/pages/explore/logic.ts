// Console admin 07/2026 — logique pure de la page Curation Explore (testable
// sans Refine). Tables explore_collections + explore_items (migration 0045).
//
// CONVENTION TEXTES : comme pour les défis (0040), title_key/subtitle_key
// peuvent porter soit une clé i18n de l'app (explore.<slug>.title), soit le
// texte français saisi tel quel — l'app affiche la traduction si la clé
// existe, sinon le texte brut. Le mot éditorial par lieu (editorial_text)
// est TOUJOURS du texte brut (<= 280 chars, CHECK 0045).

/** Miroir du CHECK slug 0045. */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]*$/;
/** Miroir du CHECK editorial_text 0045. */
export const EDITORIAL_MAX = 280;

export interface ExploreCollectionRow {
  id: string;
  slug: string;
  title_key: string;
  subtitle_key: string | null;
  cover_url: string | null;
  sort_order: number | null;
  is_published: boolean;
  city_code: string;
  created_at: string;
  updated_at: string;
}

export interface ExploreItemRow {
  id: string;
  collection_id: string;
  place_id: string;
  editorial_text: string | null;
  sort_order: number | null;
  places?: { name: string; neighborhood: string | null } | null;
}

// ── Validation collection ───────────────────────────────────────────────────

export interface CollectionFormValues {
  slug: string;
  title: string;
  subtitle: string;
  cover_url: string;
}

export const EMPTY_COLLECTION_FORM: CollectionFormValues = {
  slug: "",
  title: "",
  subtitle: "",
  cover_url: "",
};

export interface CollectionDbRow {
  slug: string;
  title_key: string;
  subtitle_key: string | null;
  cover_url: string | null;
}

export type CollectionValidation =
  | { ok: true; row: CollectionDbRow }
  | { ok: false; errors: string[] };

export function validateCollectionForm(v: CollectionFormValues): CollectionValidation {
  const errors: string[] = [];
  if (!SLUG_REGEX.test(v.slug.trim())) {
    errors.push("Slug invalide (minuscules/chiffres/tirets, ex. maquis-qui-ont-le-feu).");
  }
  if (v.title.trim().length === 0) errors.push("Le titre est obligatoire.");
  if (v.cover_url && !/^https?:\/\//.test(v.cover_url.trim())) {
    errors.push("L'URL de couverture doit commencer par http(s)://");
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    row: {
      slug: v.slug.trim(),
      title_key: v.title.trim(),
      subtitle_key: v.subtitle.trim() || null,
      cover_url: v.cover_url.trim() || null,
    },
  };
}

export function collectionRowToForm(row: ExploreCollectionRow): CollectionFormValues {
  return {
    slug: row.slug,
    title: row.title_key,
    subtitle: row.subtitle_key ?? "",
    cover_url: row.cover_url ?? "",
  };
}

// ── Items : validation + ordonnancement ─────────────────────────────────────

export function validateEditorialText(text: string): string | null {
  if (text.length > EDITORIAL_MAX) {
    return `Mot éditorial trop long (${text.length}/${EDITORIAL_MAX}).`;
  }
  return null;
}

/** Prochain sort_order pour un ajout en fin de collection. */
export function nextSortOrder(items: Pick<ExploreItemRow, "sort_order">[]): number {
  const max = items.reduce((acc, it) => Math.max(acc, it.sort_order ?? 0), -1);
  return max + 1;
}

/**
 * Déplacement d'un item (haut/bas) — retourne la liste réordonnée avec des
 * sort_order re-normalisés 0..n-1, ou null si déplacement impossible (bord).
 * Pure : la page persiste ensuite les sort_order modifiés.
 */
export function moveItem<T extends Pick<ExploreItemRow, "id" | "sort_order">>(
  items: T[],
  itemId: string,
  direction: "up" | "down",
): T[] | null {
  const ordered = [...items].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const index = ordered.findIndex((it) => it.id === itemId);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return null;
  const next = [...ordered];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((it, i) => ({ ...it, sort_order: i }));
}

/** Les rows dont le sort_order a changé (updates minimaux à persister). */
export function changedSortOrders<T extends Pick<ExploreItemRow, "id" | "sort_order">>(
  before: T[],
  after: T[],
): { id: string; sort_order: number }[] {
  const prev = new Map(before.map((it) => [it.id, it.sort_order ?? 0]));
  return after
    .filter((it) => prev.get(it.id) !== it.sort_order)
    .map((it) => ({ id: it.id, sort_order: it.sort_order ?? 0 }));
}
