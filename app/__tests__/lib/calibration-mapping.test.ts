// Story 2.5 — AC #5 + #7 : moteur pur calibration-mapping.

import {
  CALIBRATION_QUESTIONS,
  resolveDirection,
} from "../../src/lib/calibration-mapping";
import { PALAIS_AXES } from "../../src/types/palais";

describe("calibration-mapping (Story 2.5)", () => {
  describe("CALIBRATION_QUESTIONS catalogue", () => {
    it("expose une question pour chacun des 5 axes Palais", () => {
      const axes = CALIBRATION_QUESTIONS.map((q) => q.axis);
      for (const a of PALAIS_AXES) {
        expect(axes).toContain(a);
      }
      expect(CALIBRATION_QUESTIONS).toHaveLength(PALAIS_AXES.length);
    });

    it("chaque question a au moins 2 cartes neg ET 2 cartes pos", () => {
      for (const q of CALIBRATION_QUESTIONS) {
        const neg = q.cards.filter((c) => c.polarity === "neg").length;
        const pos = q.cards.filter((c) => c.polarity === "pos").length;
        expect(neg).toBeGreaterThanOrEqual(2);
        expect(pos).toBeGreaterThanOrEqual(2);
      }
    });

    it("chaque card a un labelKey i18n distinct", () => {
      for (const q of CALIBRATION_QUESTIONS) {
        const keys = q.cards.map((c) => c.labelKey);
        expect(new Set(keys).size).toBe(keys.length);
      }
    });
  });

  describe("resolveDirection", () => {
    it("0 carte sélectionnée → neutral", () => {
      const q = CALIBRATION_QUESTIONS[0]!;
      expect(resolveDirection([], q.cards)).toBe("neutral");
    });

    for (const q of CALIBRATION_QUESTIONS) {
      const negIndices = q.cards
        .map((c, i) => (c.polarity === "neg" ? i : -1))
        .filter((i) => i >= 0);
      const posIndices = q.cards
        .map((c, i) => (c.polarity === "pos" ? i : -1))
        .filter((i) => i >= 0);

      it(`axe ${q.axis} — toutes neg → neg`, () => {
        expect(resolveDirection(negIndices, q.cards)).toBe("neg");
      });
      it(`axe ${q.axis} — toutes pos → pos`, () => {
        expect(resolveDirection(posIndices, q.cards)).toBe("pos");
      });
      it(`axe ${q.axis} — mix (1 neg + 1 pos) → neutral`, () => {
        expect(resolveDirection([negIndices[0]!, posIndices[0]!], q.cards)).toBe(
          "neutral",
        );
      });
    }
  });
});
