// CR Chunk A M8 — stadeTitleKeysBetween : unlock TOUS les titres intermédiaires
// entre l'ancien stade et le nouveau (cas saut multi-stade).

import {
  STADE_ORDER,
  STADE_TITLE_KEYS,
  stadeTitleKeysBetween,
} from "../titres-catalogue";

describe("stadeTitleKeysBetween — CR Chunk A M8", () => {
  it("retourne [] si prev === next (no stade change)", () => {
    expect(stadeTitleKeysBetween("touriste", "touriste")).toEqual([]);
    expect(stadeTitleKeysBetween("guide", "guide")).toEqual([]);
  });

  it("retourne [] si next < prev (downgrade impossible)", () => {
    expect(stadeTitleKeysBetween("guide", "touriste")).toEqual([]);
    expect(stadeTitleKeysBetween("detective", "explorateur")).toEqual([]);
  });

  it("retourne le seul titre cible si prev et next sont voisins", () => {
    expect(stadeTitleKeysBetween("touriste", "explorateur")).toEqual([
      STADE_TITLE_KEYS.explorateur,
    ]);
    expect(stadeTitleKeysBetween("djidji", "guide")).toEqual([
      STADE_TITLE_KEYS.guide,
    ]);
  });

  it("retourne TOUS les titres intermédiaires sur saut multi-stade (M8)", () => {
    // touriste → detective : doit unlock explorateur + detective
    expect(stadeTitleKeysBetween("touriste", "detective")).toEqual([
      STADE_TITLE_KEYS.explorateur,
      STADE_TITLE_KEYS.detective,
    ]);
    // touriste → guide : doit unlock 4 titres
    expect(stadeTitleKeysBetween("touriste", "guide")).toEqual([
      STADE_TITLE_KEYS.explorateur,
      STADE_TITLE_KEYS.detective,
      STADE_TITLE_KEYS.djidji,
      STADE_TITLE_KEYS.guide,
    ]);
    // explorateur → djidji : doit unlock detective + djidji
    expect(stadeTitleKeysBetween("explorateur", "djidji")).toEqual([
      STADE_TITLE_KEYS.detective,
      STADE_TITLE_KEYS.djidji,
    ]);
  });

  it("STADE_ORDER expose les 5 stades dans l'ordre canonique PRD §5.2", () => {
    expect(STADE_ORDER).toEqual([
      "touriste",
      "explorateur",
      "detective",
      "djidji",
      "guide",
    ]);
  });
});
