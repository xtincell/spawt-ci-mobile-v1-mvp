// Console admin 07/2026 — tests logique pure page Curation Explore (0045).

import { describe, it, expect } from "vitest";
import {
  EDITORIAL_MAX,
  EMPTY_COLLECTION_FORM,
  SLUG_REGEX,
  changedSortOrders,
  collectionRowToForm,
  moveItem,
  nextSortOrder,
  validateCollectionForm,
  validateEditorialText,
} from "./logic";

describe("validateCollectionForm", () => {
  const valid = {
    ...EMPTY_COLLECTION_FORM,
    slug: "maquis-qui-ont-le-feu",
    title: "Les maquis qui ont le feu",
  };

  it("accepte un carnet valide (sous-titre/cover vides → NULL)", () => {
    const res = validateCollectionForm(valid);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.subtitle_key).toBeNull();
      expect(res.row.cover_url).toBeNull();
      expect(res.row.title_key).toBe("Les maquis qui ont le feu");
    }
  });

  it("refuse un slug hors CHECK 0045 (majuscules, accents, tiret initial)", () => {
    expect(SLUG_REGEX.test("Maquis")).toBe(false);
    expect(SLUG_REGEX.test("-feu")).toBe(false);
    expect(validateCollectionForm({ ...valid, slug: "Sucré comme Cocody" }).ok).toBe(false);
  });

  it("refuse titre vide et cover non http(s)", () => {
    expect(validateCollectionForm({ ...valid, title: " " }).ok).toBe(false);
    expect(validateCollectionForm({ ...valid, cover_url: "ftp://x" }).ok).toBe(false);
  });
});

describe("validateEditorialText (CHECK <= 280)", () => {
  it("borne à 280 caractères, null = OK", () => {
    expect(validateEditorialText("Le poisson qui met tout le monde d'accord.")).toBeNull();
    expect(validateEditorialText("x".repeat(EDITORIAL_MAX))).toBeNull();
    expect(validateEditorialText("x".repeat(EDITORIAL_MAX + 1))).toMatch(/281\/280/);
  });
});

describe("ordonnancement des items", () => {
  const items = [
    { id: "a", sort_order: 0 },
    { id: "b", sort_order: 1 },
    { id: "c", sort_order: 2 },
  ];

  it("nextSortOrder = max + 1 (0 sur collection vide)", () => {
    expect(nextSortOrder(items)).toBe(3);
    expect(nextSortOrder([])).toBe(0);
  });

  it("moveItem down/up échange les voisins et re-normalise 0..n-1", () => {
    const down = moveItem(items, "a", "down");
    expect(down?.map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(down?.map((i) => i.sort_order)).toEqual([0, 1, 2]);
    const up = moveItem(items, "c", "up");
    expect(up?.map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("déplacement impossible aux bords / id inconnu → null", () => {
    expect(moveItem(items, "a", "up")).toBeNull();
    expect(moveItem(items, "c", "down")).toBeNull();
    expect(moveItem(items, "zz", "up")).toBeNull();
  });

  it("changedSortOrders ne retient que les updates nécessaires", () => {
    const after = moveItem(items, "a", "down");
    expect(changedSortOrders(items, after ?? [])).toEqual([
      { id: "b", sort_order: 0 },
      { id: "a", sort_order: 1 },
    ]);
  });
});

describe("collectionRowToForm", () => {
  it("re-pivote la row DB vers le formulaire", () => {
    const form = collectionRowToForm({
      id: "c1",
      slug: "sucre-comme-cocody",
      title_key: "Sucré comme Cocody",
      subtitle_key: null,
      cover_url: "https://x/c.jpg",
      sort_order: 1,
      is_published: true,
      city_code: "abidjan",
      created_at: "",
      updated_at: "",
    });
    expect(form.slug).toBe("sucre-comme-cocody");
    expect(form.subtitle).toBe("");
    expect(form.cover_url).toBe("https://x/c.jpg");
  });
});
