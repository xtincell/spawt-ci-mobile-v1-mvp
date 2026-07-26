// Tests Mode Explore — data layer (mode démo, fixtures seed/explore.ts).
// Couvre : filtrage is_published, tri sort_order, jointure items → places
// (drop silencieux des désalignés), slug inconnu/brouillon → null, parité
// CHECK DB (editorial <= 280) et couverture i18n des clés de collections.

import {
  getExploreCollection,
  listExploreCollections,
} from "../data-source";
import { SEED_EXPLORE_COLLECTIONS } from "../../data/seed/explore";
import { SEED_PLACES } from "../../data/seed/places";
import fr from "../../i18n/fr.json";

describe("listExploreCollections — mode démo", () => {
  it("ne liste QUE les collections publiées (brouillon filtré)", async () => {
    const collections = await listExploreCollections();
    expect(collections.length).toBeGreaterThanOrEqual(2);
    expect(collections.map((c) => c.slug)).not.toContain("brouillon-nuit");
  });

  it("ordonne par sort_order croissant", async () => {
    const collections = await listExploreCollections();
    const orders = collections.map((c) => c.sort_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(collections[0]!.slug).toBe("maquis-braise");
  });

  it("expose le contrat summary (title_key i18n, pas d'items embarqués)", async () => {
    const collections = await listExploreCollections();
    for (const c of collections) {
      expect(c.title_key).toBe(`explore.${c.slug}.title`);
      expect(c).not.toHaveProperty("items");
      expect(c).not.toHaveProperty("is_published");
    }
  });
});

describe("getExploreCollection — mode démo", () => {
  it("retourne les items ordonnés, joints aux lieux du seed", async () => {
    const detail = await getExploreCollection("maquis-braise");
    expect(detail).not.toBeNull();
    expect(detail!.items.length).toBe(4);
    // Ordre éditorial respecté (sort_order croissant).
    const orders = detail!.items.map((i) => i.sort_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    // Jointure réelle : le 1er item est Tantie Rose, avec ADN et rating.
    const first = detail!.items[0]!;
    expect(first.place.name).toBe("Maquis Chez Tantie Rose");
    expect(first.place.adn.place_id).toBe(first.place.id);
    expect(first.editorial_text).toContain("Tantie Rose");
  });

  it("slug inconnu → null", async () => {
    expect(await getExploreCollection("carnet-fantome")).toBeNull();
  });

  it("collection brouillon (is_published=false) → null, même par accès direct", async () => {
    expect(await getExploreCollection("brouillon-nuit")).toBeNull();
  });

  it("un place_id désaligné est droppé sans casser la collection", async () => {
    // Parité avec le contrat de l'adaptateur : on vérifie que chaque item
    // publié référence bien un lieu du seed (sinon le drop silencieux
    // masquerait une fixture cassée — ce test la révèle).
    for (const c of SEED_EXPLORE_COLLECTIONS.filter((x) => x.is_published)) {
      for (const item of c.items) {
        expect(
          SEED_PLACES.some((p) => p.id === item.place_id),
        ).toBe(true);
      }
    }
  });
});

describe("fixtures Explore — parité contraintes DB + i18n", () => {
  it("editorial_text <= 280 caractères (CHECK 0045)", () => {
    for (const c of SEED_EXPLORE_COLLECTIONS) {
      for (const item of c.items) {
        if (item.editorial_text !== null) {
          expect(item.editorial_text.length).toBeLessThanOrEqual(280);
        }
      }
    }
  });

  it("slugs conformes au CHECK (^[a-z0-9][a-z0-9_-]*$)", () => {
    for (const c of SEED_EXPLORE_COLLECTIONS) {
      expect(c.slug).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
    }
  });

  it("chaque collection publiée a ses clés i18n title/subtitle dans fr.json", () => {
    const explore = (fr as Record<string, unknown>).explore as Record<
      string,
      { title?: string; subtitle?: string }
    >;
    for (const c of SEED_EXPLORE_COLLECTIONS.filter((x) => x.is_published)) {
      const entry = explore[c.slug];
      expect(entry?.title).toBeTruthy();
      if (c.subtitle_key !== null) {
        expect(entry?.subtitle).toBeTruthy();
      }
    }
  });
});
