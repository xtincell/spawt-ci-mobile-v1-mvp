// Story 5.2 — snapshot du catalogue de titres (anti-drift Sprint 1).
// Toute modification volontaire doit passer par PR + review Alexandre.

import {
  STADE_TITLE_KEYS,
  PREMIER_SPAWT_TITLE_KEY,
  isKnownTitleKey,
  defaultTitleKeyForStade,
} from "../titres-catalogue";

describe("titres-catalogue — Story 5.2", () => {
  it("STADE_TITLE_KEYS expose exactement 5 entrées (1 par stade)", () => {
    expect(STADE_TITLE_KEYS).toEqual({
      touriste: "title.touriste",
      explorateur: "title.explorateur",
      detective: "title.detective",
      djidji: "title.djidji",
      guide: "title.guide",
    });
  });

  it("PREMIER_SPAWT_TITLE_KEY est la seule clé bonus Sprint 1 (D4)", () => {
    expect(PREMIER_SPAWT_TITLE_KEY).toBe("title.premier_spawt");
  });

  it("isKnownTitleKey accepte les 6 clés et rejette les inconnues", () => {
    expect(isKnownTitleKey("title.touriste")).toBe(true);
    expect(isKnownTitleKey("title.guide")).toBe(true);
    expect(isKnownTitleKey("title.premier_spawt")).toBe(true);
    expect(isKnownTitleKey("title.archetype.unknown")).toBe(false);
    expect(isKnownTitleKey("")).toBe(false);
  });

  it("defaultTitleKeyForStade retourne la clé du stade demandé", () => {
    expect(defaultTitleKeyForStade("touriste")).toBe("title.touriste");
    expect(defaultTitleKeyForStade("djidji")).toBe("title.djidji");
  });
});
