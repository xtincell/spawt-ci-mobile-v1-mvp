// Refonte fiche lieu (R21) — formatage du prix moyen F CFA.
// « ~N F CFA » : milliers groupés par espace insécable (U+00A0), fallback
// null (→ échelle ₣) si la valeur est absente/invalide/non positive.

import { formatXofAmount, NBSP } from "../../src/lib/format-price";

describe("formatXofAmount — R21 prix moyen F CFA", () => {
  it("NBSP est bien l'espace insécable U+00A0", () => {
    expect(NBSP).toHaveLength(1);
    expect(NBSP.charCodeAt(0)).toBe(0xa0);
  });

  it("groupe les milliers par espace insécable (8000 → « 8 000 »)", () => {
    expect(formatXofAmount(8000)).toBe(`8${NBSP}000`);
  });

  it("valeurs plausibles Abidjan : garba ~1500, maquis ~6000, chic ~25000", () => {
    expect(formatXofAmount(1500)).toBe(`1${NBSP}500`);
    expect(formatXofAmount(6000)).toBe(`6${NBSP}000`);
    expect(formatXofAmount(25000)).toBe(`25${NBSP}000`);
  });

  it("ne touche pas aux montants < 1000 (pas de séparateur)", () => {
    expect(formatXofAmount(800)).toBe("800");
    expect(formatXofAmount(1)).toBe("1");
  });

  it("groupe correctement au-delà du million", () => {
    expect(formatXofAmount(1234567)).toBe(`1${NBSP}234${NBSP}567`);
  });

  it("arrondit les décimales à l'unité (le F CFA ne se subdivise pas)", () => {
    expect(formatXofAmount(6000.4)).toBe(`6${NBSP}000`);
    expect(formatXofAmount(999.6)).toBe(`1${NBSP}000`);
  });

  it("retourne null si absent — le caller retombe sur l'échelle ₣", () => {
    expect(formatXofAmount(null)).toBeNull();
    expect(formatXofAmount(undefined)).toBeNull();
  });

  it("retourne null si non strictement positif ou invalide", () => {
    expect(formatXofAmount(0)).toBeNull();
    expect(formatXofAmount(-1500)).toBeNull();
    expect(formatXofAmount(Number.NaN)).toBeNull();
    expect(formatXofAmount(Number.POSITIVE_INFINITY)).toBeNull();
    // 0.4 arrondi → 0 → null (pas de « 0 F CFA » affiché).
    expect(formatXofAmount(0.4)).toBeNull();
  });
});
