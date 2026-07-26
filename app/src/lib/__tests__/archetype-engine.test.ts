// Chantier 13 archétypes — tests de PARITÉ du moteur vs le quiz « La Meute ».
//
// Les fixtures ci-dessous sont la SORTIE DU MOTEUR JS DU QUIZ LUI-MÊME
// (spawt-meute-quiz/public/jeu.html, computeArchetype l.757-767), générées le
// 2026-07-26 via `node app/scripts/gen-archetype-fixtures.mjs` (le script
// extrait la fonction du HTML et l'exécute en Node). Si le moteur du quiz
// évolue, re-générer et resynchroniser — ne PAS "corriger" ces valeurs à la
// main.
//
// Couverture : les 12 archétypes à paire (axes purs), les 2 garde-fous
// omnivore (intensity ≤ 2 ; pas de paire propre ET intensity ≤ 4), le clamp
// [-2,2], le tie-break par tri stable, et des profils issus de la calibration
// app (±0.4 → ×2 → ±0.8).

import {
  ARCHETYPE_KEYS,
  ARCHETYPE_PAIRS,
  computeArchetype,
  computeArchetypeFromPalais,
  isArchetypeKey,
  palaisToQuizAxes,
  type QuizAxes,
} from "../archetype-engine";

interface ParityFixture {
  label: string;
  scores: QuizAxes;
  expected: { key: string; runnerUp: string | null };
}

// ━━━ Vérité terrain générée par le moteur du quiz (voir en-tête) ━━━━━━━━━━━
const PARITY_FIXTURES: ParityFixture[] = [
  { label: "gardien pur (T-2 M-2)", scores: { R: 0, T: -2, E: 0, F: 0, M: -2 }, expected: { key: "gardien", runnerUp: "ancre" } },
  { label: "ancre pur (T-2 M+2)", scores: { R: 0, T: -2, E: 0, F: 0, M: 2 }, expected: { key: "ancre", runnerUp: "gardien" } },
  { label: "bouchedor pur (T+2 M+2)", scores: { R: 0, T: 2, E: 0, F: 0, M: 2 }, expected: { key: "bouchedor", runnerUp: "ancre" } },
  { label: "braise pur (F-2 E+2)", scores: { R: 0, T: 0, E: 2, F: -2, M: 0 }, expected: { key: "braise", runnerUp: "gardien" } },
  { label: "memoire pur (T-2 R-2)", scores: { R: -2, T: -2, E: 0, F: 0, M: 0 }, expected: { key: "memoire", runnerUp: "gardien" } },
  { label: "pisteur pur (T+2 M-2)", scores: { R: 0, T: 2, E: 0, F: 0, M: -2 }, expected: { key: "pisteur", runnerUp: "gardien" } },
  { label: "vent pur (R+2 T+2)", scores: { R: 2, T: 2, E: 0, F: 0, M: 0 }, expected: { key: "vent", runnerUp: "bouchedor" } },
  { label: "fantome pur (T+2 F+2)", scores: { R: 0, T: 2, E: 0, F: 2, M: 0 }, expected: { key: "fantome", runnerUp: "bouchedor" } },
  { label: "murmure pur (F+2 M-2)", scores: { R: 0, T: 0, E: 0, F: 2, M: -2 }, expected: { key: "murmure", runnerUp: "gardien" } },
  { label: "oeil pur (F+2 E-2)", scores: { R: 0, T: 0, E: -2, F: 2, M: 0 }, expected: { key: "oeil", runnerUp: "fantome" } },
  { label: "lame pur (M+2 E-2)", scores: { R: 0, T: 0, E: -2, F: 0, M: 2 }, expected: { key: "lame", runnerUp: "ancre" } },
  { label: "passeport pur (M+2 R+2)", scores: { R: 2, T: 0, E: 0, F: 0, M: 2 }, expected: { key: "passeport", runnerUp: "ancre" } },
  { label: "omnivore intensity 0", scores: { R: 0, T: 0, E: 0, F: 0, M: 0 }, expected: { key: "omnivore", runnerUp: "gardien" } },
  { label: "omnivore intensity 2 (R-1 M-1)", scores: { R: -1, T: 0, E: 0, F: 0, M: -1 }, expected: { key: "omnivore", runnerUp: "gardien" } },
  { label: "omnivore noClean intensity 4 (R-2 F-2)", scores: { R: -2, T: 0, E: 0, F: -2, M: 0 }, expected: { key: "omnivore", runnerUp: "braise" } },
  { label: "clean pair à intensity 4 exactement (calibration ±0.8, tie gardien/braise → tri stable)", scores: { R: -0.8, T: -0.8, E: 0.8, F: -0.8, M: -0.8 }, expected: { key: "gardien", runnerUp: "braise" } },
  { label: "clamp au-delà de ±2 (accumulation quiz)", scores: { R: -3, T: -4, E: 1, F: -1, M: -3 }, expected: { key: "gardien", runnerUp: "memoire" } },
  { label: "mixte réaliste pisteur vs murmure", scores: { R: -1, T: 2, E: 0, F: 1, M: -2 }, expected: { key: "pisteur", runnerUp: "fantome" } },
  { label: "mixte réaliste vent vs passeport", scores: { R: 2, T: 1, E: 0, F: 0, M: 2 }, expected: { key: "passeport", runnerUp: "bouchedor" } },
  { label: "calibration ±0.8 fantome partiel → omnivore (intensity 1.6 ≤ 2)", scores: { R: 0, T: 0.8, E: 0, F: 0.8, M: 0 }, expected: { key: "omnivore", runnerUp: "fantome" } },
];

describe("archetype-engine — parité avec le moteur du quiz", () => {
  it.each(PARITY_FIXTURES)("$label", ({ scores, expected }) => {
    const out = computeArchetype(scores);
    expect(out.key).toBe(expected.key);
    expect(out.runnerUp).toBe(expected.runnerUp);
  });

  it("les fixtures couvrent chaque archétype au moins une fois", () => {
    const seen = new Set(PARITY_FIXTURES.map((f) => f.expected.key));
    for (const key of ARCHETYPE_KEYS) {
      expect(seen.has(key)).toBe(true);
    }
  });
});

describe("archetype-engine — conversion Palais app → échelle quiz", () => {
  it("×2 linéaire, aucun axe inversé (polarité vérifiée axe par axe)", () => {
    const axes = palaisToQuizAxes({
      axe_racines_horizons: -0.5, // Racines → R négatif
      axe_taniere_nomade: 0.25, // Nomade → T positif
      axe_exigeant_enthousiaste: -1, // Exigeant → E négatif
      axe_foule_secret: 1, // Secret → F positif
      axe_maquis_table: 0, // neutre
    });
    expect(axes).toEqual({ R: -1, T: 0.5, E: -2, F: 2, M: 0 });
  });

  it("clamp [-2, 2] même sur entrée hors [-1, 1] (données corrompues)", () => {
    const axes = palaisToQuizAxes({
      axe_racines_horizons: 5,
      axe_taniere_nomade: -5,
      axe_exigeant_enthousiaste: 1.5,
      axe_foule_secret: -1.5,
      axe_maquis_table: 0,
    });
    expect(axes).toEqual({ R: 2, T: -2, E: 2, F: -2, M: 0 });
  });

  it("computeArchetypeFromPalais = conversion + calcul (gardien profil maquis fidèle)", () => {
    const out = computeArchetypeFromPalais({
      axe_racines_horizons: 0,
      axe_taniere_nomade: -1,
      axe_exigeant_enthousiaste: 0,
      axe_foule_secret: 0,
      axe_maquis_table: -1,
    });
    expect(out.key).toBe("gardien");
  });

  it("calibration typique ±0.4 sur 2 axes seulement → omnivore (garde-fou intensity)", () => {
    // 2 axes répondus à ±0.4 → ×2 = ±0.8 → intensity 1.6 ≤ 2 → omnivore.
    const out = computeArchetypeFromPalais({
      axe_racines_horizons: 0,
      axe_taniere_nomade: 0.4,
      axe_exigeant_enthousiaste: 0,
      axe_foule_secret: 0.4,
      axe_maquis_table: 0,
    });
    expect(out.key).toBe("omnivore");
    expect(out.runnerUp).toBe("fantome");
  });

  it("calibration complète 5 axes ±0.4 → archétype franc (pas omnivore)", () => {
    // 5 axes répondus → intensity 4.0, paire T/M propre → gardien.
    const out = computeArchetypeFromPalais({
      axe_racines_horizons: -0.4,
      axe_taniere_nomade: -0.4,
      axe_exigeant_enthousiaste: 0.4,
      axe_foule_secret: -0.4,
      axe_maquis_table: -0.4,
    });
    expect(out.key).toBe("gardien");
  });
});

describe("archetype-engine — invariants structurels", () => {
  it("13 clés canoniques, 12 paires (omnivore sans paire)", () => {
    expect(ARCHETYPE_KEYS).toHaveLength(13);
    expect(ARCHETYPE_PAIRS).toHaveLength(12);
    expect(ARCHETYPE_PAIRS.some((p) => (p.key as string) === "omnivore")).toBe(false);
  });

  it("isArchetypeKey filtre les clés inconnues", () => {
    expect(isArchetypeKey("pisteur")).toBe(true);
    expect(isArchetypeKey("omnivore")).toBe(true);
    expect(isArchetypeKey("licorne")).toBe(false);
    expect(isArchetypeKey(null)).toBe(false);
    expect(isArchetypeKey(42)).toBe(false);
  });
});
