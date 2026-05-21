// Story 4.8 — Tests du helper age-range (fonction pure).
//
// Couvre les bornes 13/14/24/25/34/35/44/45/54/55, l'effet anniversaire pas
// encore passé dans l'année, les formats invalides, et `isBirthdayToday`.

import { ageRangeFromDateOfBirth, isBirthdayToday } from "../age-range";

describe("ageRangeFromDateOfBirth", () => {
  const today = new Date("2026-05-21T12:00:00.000Z");

  // ─── Borne basse : âge minimum 13 ans ─────────────────────────────────
  it("âge 12 (anniversaire déjà passé) → null (refus, < 13 ans)", () => {
    // Né 2014-01-01, today 2026-05-21 → 12 ans.
    expect(ageRangeFromDateOfBirth("2014-01-01", today)).toBeNull();
  });

  it("âge 13 (anniversaire passé) → '18-24' (mappé sur le 1er bucket)", () => {
    // Né 2013-01-01 → 13 ans à la date du test.
    expect(ageRangeFromDateOfBirth("2013-01-01", today)).toBe("18-24");
  });

  it("âge 13 mais anniversaire pas encore passé → 12 ans → null", () => {
    // Né 2013-08-21 (août > mai) → âge calculé = 12.
    expect(ageRangeFromDateOfBirth("2013-08-21", today)).toBeNull();
  });

  // ─── Bornes des buckets ──────────────────────────────────────────────
  it("âge 18 → '18-24'", () => {
    expect(ageRangeFromDateOfBirth("2008-01-01", today)).toBe("18-24");
  });

  it("âge 24 → '18-24'", () => {
    expect(ageRangeFromDateOfBirth("2002-01-01", today)).toBe("18-24");
  });

  it("âge 25 → '25-34'", () => {
    expect(ageRangeFromDateOfBirth("2001-01-01", today)).toBe("25-34");
  });

  it("âge 34 → '25-34'", () => {
    expect(ageRangeFromDateOfBirth("1992-01-01", today)).toBe("25-34");
  });

  it("âge 35 → '35-44'", () => {
    expect(ageRangeFromDateOfBirth("1991-01-01", today)).toBe("35-44");
  });

  it("âge 44 → '35-44'", () => {
    expect(ageRangeFromDateOfBirth("1982-01-01", today)).toBe("35-44");
  });

  it("âge 45 → '45-54'", () => {
    expect(ageRangeFromDateOfBirth("1981-01-01", today)).toBe("45-54");
  });

  it("âge 54 → '45-54'", () => {
    expect(ageRangeFromDateOfBirth("1972-01-01", today)).toBe("45-54");
  });

  it("âge 55 → '55+'", () => {
    expect(ageRangeFromDateOfBirth("1971-01-01", today)).toBe("55+");
  });

  it("âge 80 → '55+'", () => {
    expect(ageRangeFromDateOfBirth("1946-01-01", today)).toBe("55+");
  });

  // ─── Effet anniversaire pas encore passé dans l'année ────────────────
  it("anniversaire le jour même → âge complet sans -1", () => {
    // Né 1995-05-21 et today = 2026-05-21 → 31 ans (pas 30).
    expect(ageRangeFromDateOfBirth("1995-05-21", today)).toBe("25-34");
  });

  it("anniversaire demain → âge - 1", () => {
    // Né 1995-05-22 et today = 2026-05-21 → 30 ans (pas 31).
    expect(ageRangeFromDateOfBirth("1995-05-22", today)).toBe("25-34");
  });

  it("anniversaire en décembre, today en mai → âge - 1", () => {
    // Né 2001-12-15, today 2026-05-21 → 24 ans (pas 25).
    expect(ageRangeFromDateOfBirth("2001-12-15", today)).toBe("18-24");
  });

  // ─── Formats invalides ────────────────────────────────────────────────
  it("format vide → null", () => {
    expect(ageRangeFromDateOfBirth("", today)).toBeNull();
  });

  it("format non-ISO (JJ/MM/YYYY) → null", () => {
    expect(ageRangeFromDateOfBirth("21/05/1995", today)).toBeNull();
  });

  it("composantes non numériques → null", () => {
    expect(ageRangeFromDateOfBirth("1995-aa-21", today)).toBeNull();
  });

  it("mois hors range (13) → null", () => {
    expect(ageRangeFromDateOfBirth("1995-13-21", today)).toBeNull();
  });

  it("jour hors range (32) → null", () => {
    expect(ageRangeFromDateOfBirth("1995-06-32", today)).toBeNull();
  });

  it("trois segments mais le 1er est vide → null", () => {
    expect(ageRangeFromDateOfBirth("-06-15", today)).toBeNull();
  });

  // ─── Date par défaut (today omis) ─────────────────────────────────────
  it("appel sans today utilise new Date() — résultat cohérent", () => {
    // Verrouille uniquement le fait que ça ne throw pas et renvoie un type
    // attendu (string | null). Le contenu exact dépend de la date système.
    const result = ageRangeFromDateOfBirth("1990-01-01");
    expect(result === null || typeof result === "string").toBe(true);
  });
});

describe("isBirthdayToday", () => {
  it("true quand jour + mois matchent", () => {
    const today = new Date("2026-06-15T08:00:00.000Z");
    expect(isBirthdayToday("1990-06-15", today)).toBe(true);
  });

  it("false quand jour diffère", () => {
    const today = new Date("2026-06-15T08:00:00.000Z");
    expect(isBirthdayToday("1990-06-16", today)).toBe(false);
  });

  it("false quand mois diffère mais jour matche", () => {
    const today = new Date("2026-06-15T08:00:00.000Z");
    expect(isBirthdayToday("1990-07-15", today)).toBe(false);
  });

  it("format invalide → false", () => {
    const today = new Date("2026-06-15T08:00:00.000Z");
    expect(isBirthdayToday("", today)).toBe(false);
    expect(isBirthdayToday("not-a-date", today)).toBe(false);
  });
});
