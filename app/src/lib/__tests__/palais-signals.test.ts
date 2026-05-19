// Story 4.6 — Tests palais-signals.

jest.mock("../analytics", () => ({
  __esModule: true,
  track: jest.fn(),
}));

import {
  TAG_TO_SIGNALS,
  PLACE_SIGNAL_TO_SIGNALS,
  noteToSignals,
  applyReviewToPalais,
  TOTAL_SIGNAL_MAPPINGS,
} from "../palais-signals";
import type { UserPalais } from "../../types/palais";

function makePalais(overrides: Partial<UserPalais> = {}): UserPalais {
  return {
    spawter_id: "sp1",
    axe_racines_horizons: 0,
    axe_taniere_nomade: 0,
    axe_exigeant_enthousiaste: 0,
    axe_foule_secret: 0,
    axe_maquis_table: 0,
    confidence_score: 0,
    dominant_axes: null,
    archetype_id: null,
    stade: "touriste",
    total_spawts: 0,
    updated_at: "2026-05-20T00:00:00Z",
    ...overrides,
  };
}

describe("palais-signals — mapping snapshots", () => {
  it("TAG_TO_SIGNALS — figé (5 tags × ≥1 signal)", () => {
    expect(TAG_TO_SIGNALS).toMatchSnapshot();
  });
  it("PLACE_SIGNAL_TO_SIGNALS — figé", () => {
    expect(PLACE_SIGNAL_TO_SIGNALS).toMatchSnapshot();
  });
  it("TOTAL_SIGNAL_MAPPINGS = invariant", () => {
    expect(TOTAL_SIGNAL_MAPPINGS).toBe(15);
  });
});

describe("noteToSignals", () => {
  it("note 3 → no-op", () => {
    expect(noteToSignals(3)).toEqual([]);
  });
  it("note 5 → signal positif exigeant_enthousiaste poids 0.04", () => {
    const s = noteToSignals(5);
    expect(s).toHaveLength(1);
    expect(s[0]).toEqual({
      axis: "exigeant_enthousiaste",
      direction: 1,
      weight: 0.04,
    });
  });
  it("note 1 → signal négatif poids 0.04", () => {
    expect(noteToSignals(1)[0]?.direction).toBe(-1);
    expect(noteToSignals(1)[0]?.weight).toBe(0.04);
  });
});

describe("applyReviewToPalais", () => {
  it("note 3 + tags [] + signals [] → no-op (didUpdate=false)", () => {
    const out = applyReviewToPalais({
      current: makePalais(),
      unique_spots: 5,
      note: 3,
      tags: [],
      place_signals: [],
    });
    expect(out.didUpdate).toBe(false);
    expect(out.palais.axe_exigeant_enthousiaste).toBe(0);
  });

  it("note 5 + tag a_refaire + signal institution → axes bougent positivement", () => {
    const out = applyReviewToPalais({
      current: makePalais(),
      unique_spots: 5,
      note: 5,
      tags: ["a_refaire"],
      place_signals: ["institution"],
    });
    expect(out.didUpdate).toBe(true);
    // exigeant_enthousiaste positif (note 5 + a_refaire).
    expect(out.palais.axe_exigeant_enthousiaste).toBeGreaterThan(0);
    // racines_horizons négatif (institution).
    expect(out.palais.axe_racines_horizons).toBeLessThan(0);
  });

  it("axes restent dans [-1, 1] (clamp)", () => {
    const out = applyReviewToPalais({
      current: makePalais({ axe_exigeant_enthousiaste: 0.99 }),
      unique_spots: 1,
      note: 5,
      tags: ["a_refaire"],
      place_signals: [],
    });
    expect(out.palais.axe_exigeant_enthousiaste).toBeLessThanOrEqual(1);
  });

  it("tag inconnu skipped silencieusement", () => {
    const out = applyReviewToPalais({
      current: makePalais(),
      unique_spots: 5,
      note: 3,
      tags: ["unknown_tag"],
      place_signals: [],
    });
    expect(out.didUpdate).toBe(false);
  });
});
