// Console admin 07/2026 — tests logique pure page Promotions (0050) +
// garde Contrat SPAWT (le texte du bandeau ne doit jamais s'affaiblir).

import { describe, it, expect } from "vitest";
import {
  CONTRAT_PROMO_TEXT,
  EMPTY_PROMO_FORM,
  filterPromotions,
  isPromoActive,
  promoRowToForm,
  todayIsoDate,
  validatePromoForm,
  type PlacePromotionRow,
} from "./logic";

const TODAY = "2026-07-26";

function row(partial: Partial<PlacePromotionRow>): PlacePromotionRow {
  return {
    id: "pr1",
    place_id: "p1",
    label: "-20% attiéké",
    description: null,
    starts_at: null,
    ends_at: null,
    is_published: true,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...partial,
  };
}

describe("garde Contrat SPAWT (promotions)", () => {
  it("le texte du bandeau affirme que la promo n'affecte JAMAIS note ni classement", () => {
    expect(CONTRAT_PROMO_TEXT).toContain("affichage étiqueté");
    expect(CONTRAT_PROMO_TEXT).toContain("n'affecte jamais la note");
    expect(CONTRAT_PROMO_TEXT).toContain("classement");
    expect(CONTRAT_PROMO_TEXT.toLowerCase()).not.toContain("booste");
  });
});

describe("isPromoActive (miroir policy RLS 0050)", () => {
  it("publiée sans bornes = active", () => {
    expect(isPromoActive(row({}), TODAY)).toBe(true);
  });

  it("fenêtre couvrant aujourd'hui = active, bornes incluses", () => {
    expect(isPromoActive(row({ starts_at: "2026-07-26", ends_at: "2026-07-26" }), TODAY)).toBe(true);
  });

  it("pas encore commencée / déjà finie = inactive", () => {
    expect(isPromoActive(row({ starts_at: "2026-07-27" }), TODAY)).toBe(false);
    expect(isPromoActive(row({ ends_at: "2026-07-25" }), TODAY)).toBe(false);
  });

  it("brouillon (non publiée) = jamais active", () => {
    expect(isPromoActive(row({ is_published: false }), TODAY)).toBe(false);
  });
});

describe("filterPromotions", () => {
  const rows = [
    row({ id: "a", place_id: "p1" }),
    row({ id: "b", place_id: "p2", ends_at: "2026-07-01" }),
    row({ id: "c", place_id: "p1", is_published: false }),
  ];

  it("filtre lieu + état actif/inactif", () => {
    expect(filterPromotions(rows, "p1", "active", TODAY).map((r) => r.id)).toEqual(["a"]);
    expect(filterPromotions(rows, "all", "inactive", TODAY).map((r) => r.id)).toEqual(["b", "c"]);
    expect(filterPromotions(rows, "all", "all", TODAY)).toHaveLength(3);
  });
});

describe("validatePromoForm", () => {
  const valid = { ...EMPTY_PROMO_FORM, place_id: "p1", label: "-20% attiéké" };

  it("accepte le minimal valide (bornes vides → NULL)", () => {
    const res = validatePromoForm(valid);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.starts_at).toBeNull();
      expect(res.row.ends_at).toBeNull();
      expect(res.row.description).toBeNull();
    }
  });

  it("refuse libellé vide et lieu manquant", () => {
    const res = validatePromoForm({ ...EMPTY_PROMO_FORM, label: "  " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toHaveLength(2);
  });

  it("refuse une fin avant le début (miroir CHECK 0050)", () => {
    const res = validatePromoForm({ ...valid, starts_at: "2026-08-10", ends_at: "2026-08-01" });
    expect(res.ok).toBe(false);
  });
});

describe("todayIsoDate / promoRowToForm", () => {
  it("todayIsoDate produit YYYY-MM-DD", () => {
    expect(todayIsoDate(new Date(2026, 6, 5))).toBe("2026-07-05");
  });

  it("promoRowToForm re-pivote la row DB", () => {
    const form = promoRowToForm(row({ starts_at: "2026-08-01", description: "promo du soir" }));
    expect(form.starts_at).toBe("2026-08-01");
    expect(form.ends_at).toBe("");
    expect(form.description).toBe("promo du soir");
  });
});
