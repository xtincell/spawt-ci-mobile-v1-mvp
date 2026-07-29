// SPAWT Wrapped — tests de la garde saisonnière, de l'année racontée, du
// parse défensif de la réponse Edge et de la cohérence de la fixture démo.

import {
  isWrappedSeason,
  parseWrappedResponse,
  wrappedYearFor,
} from "../wrapped";
import { getWrappedStats } from "../data-source";
import { SEED_WRAPPED } from "../../data/seed/wrapped";
import { SEED_BADGE_CATALOGUE } from "../../data/seed/progression";

describe("isWrappedSeason — fenêtre 1er décembre → 15 janvier", () => {
  it.each([
    ["2026-12-01T00:00:00Z", true],
    ["2026-12-25T12:00:00Z", true],
    ["2027-01-01T00:00:00Z", true],
    ["2027-01-15T23:59:00Z", true],
    ["2027-01-16T00:00:00Z", false],
    ["2026-11-30T23:59:00Z", false],
    ["2026-07-14T12:00:00Z", false],
  ])("%s → %s", (iso, expected) => {
    expect(isWrappedSeason(new Date(iso))).toBe(expected);
  });
});

describe("wrappedYearFor — l'année racontée", () => {
  it("en décembre : l'année en cours", () => {
    expect(wrappedYearFor(new Date("2026-12-15T00:00:00Z"))).toBe(2026);
  });
  it("en janvier (queue de saison) : l'année qui vient de finir", () => {
    expect(wrappedYearFor(new Date("2027-01-10T00:00:00Z"))).toBe(2026);
  });
});

describe("parseWrappedResponse — frontière réseau → TS", () => {
  it("réponse valide → structure typée complète", () => {
    const parsed = parseWrappedResponse({
      year: 2026,
      stats: {
        total_spawts: 12,
        unique_places: 8,
        communes_count: 4,
        top_commune: "Cocody",
        top_cuisine: "ivoirienne",
        top_place: { id: "p1", name: "Chez Ambroise", count: 4 },
        avg_note: 4.3,
        archetype: "gardien",
        stade: "explorateur",
        pionnier_seq: 42,
        badges_unlocked: ["premier_spawt", 33, "traversee"],
        top_month: { month: 8, count: 5 },
      },
    });
    expect(parsed?.year).toBe(2026);
    expect(parsed?.stats.total_spawts).toBe(12);
    expect(parsed?.stats.top_place?.name).toBe("Chez Ambroise");
    // Les codes non-string sont filtrés (frontière défensive).
    expect(parsed?.stats.badges_unlocked).toEqual(["premier_spawt", "traversee"]);
    expect(parsed?.stats.top_month).toEqual({ month: 8, count: 5 });
  });

  it("champs best-effort absents/malformés → null champ par champ, jamais de crash", () => {
    const parsed = parseWrappedResponse({
      year: 2026,
      stats: { total_spawts: "douze", top_place: { nope: true }, top_month: null },
    });
    expect(parsed?.stats.total_spawts).toBeNull();
    expect(parsed?.stats.top_place).toBeNull();
    expect(parsed?.stats.top_month).toBeNull();
  });

  it("réponse inexploitable (pas d'objet, year manquant) → null", () => {
    expect(parseWrappedResponse(null)).toBeNull();
    expect(parseWrappedResponse("boom")).toBeNull();
    expect(parseWrappedResponse({ stats: {} })).toBeNull();
    expect(parseWrappedResponse({ year: 2026, stats: null })).toBeNull();
  });
});

describe("fixture démo — une année cohérente", () => {
  it("getWrappedStats (mode démo) sert la fixture", async () => {
    await expect(getWrappedStats()).resolves.toBe(SEED_WRAPPED);
  });

  it("badges de l'année ⊂ catalogue 0036, note dans [1,5]", () => {
    const catalogue = new Set(SEED_BADGE_CATALOGUE.map((b) => b.code));
    for (const code of SEED_WRAPPED.stats.badges_unlocked ?? []) {
      expect(catalogue.has(code)).toBe(true);
    }
    expect(SEED_WRAPPED.stats.avg_note).toBeGreaterThanOrEqual(1);
    expect(SEED_WRAPPED.stats.avg_note).toBeLessThanOrEqual(5);
    // Cohérence interne : lieux uniques ≤ spawts, mois plausible.
    expect(SEED_WRAPPED.stats.unique_places!).toBeLessThanOrEqual(
      SEED_WRAPPED.stats.total_spawts!,
    );
    expect(SEED_WRAPPED.stats.top_month?.month).toBeGreaterThanOrEqual(1);
    expect(SEED_WRAPPED.stats.top_month?.month).toBeLessThanOrEqual(12);
  });
});
