// Moteur d'archétype — port fidèle de `computeArchetype()` du quiz « La Meute »
// (repo spawt-meute-quiz, public/jeu.html — const ARCHETYPES + computeArchetype).
//
// Chantier « 13 archétypes » (PRD final §5.5) : l'app ne connaissait que 5
// archétypes dérivés des 2 axes dominants ; le quiz calcule les 13 complets.
// Ce module reproduit EXACTEMENT l'algorithme du quiz pour que le résultat
// hérité à la première connexion et les recalculs in-app soient cohérents.
//
// ━━━ Mapping d'échelle et de POLARITÉ (vérifié axe par axe, 2026-07-26) ━━━━
// Le quiz travaille en [-2, +2] par axe (clés courtes R/T/E/F/M) ; l'app
// stocke le Palais en [-1, +1] (`palais-engine.ts`, types/palais.ts).
// Conversion : LINÉAIRE ×2 puis clamp [-2, 2]. AUCUN axe n'est inversé :
//   R : Racines(-)  ↔ Horizons(+)      = axe_racines_horizons      (même signe)
//   T : Tanière(-)  ↔ Nomade(+)        = axe_taniere_nomade        (même signe)
//   E : Exigeant(-) ↔ Enthousiaste(+)  = axe_exigeant_enthousiaste (même signe)
//   F : Foule(-)    ↔ Secret(+)        = axe_foule_secret          (même signe)
//   M : Maquis(-)   ↔ Table(+)         = axe_maquis_table          (même signe)
// (Contrôle source : AXES du quiz jeu.html l.528 vs PALAIS_AXIS_LABELS.)
//
// ━━━ Algorithme (identique au quiz) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   1. clamp de chaque axe à [-2, 2]
//   2. alignement d'un pôle : align([axe, signe]) = max(0, valeur × signe)
//   3. score par paire : si les DEUX pôles alignés (A>0 et B>0)
//        sc = (A + B) + min(A, B) × 0.6      (bonus d'équilibre)
//      sinon
//        sc = (A + B) × 0.4                  (pénalité de paire boiteuse)
//   4. tri : score décroissant, puis min(A, B) décroissant. Le tri est STABLE
//      (Array.prototype.sort ES2019+) : à égalité parfaite, l'ordre de
//      déclaration des archétypes départage — ordre préservé ci-dessous.
//   5. garde-fous omnivore : intensity = Σ|axes| ;
//        (pas de paire propre ET intensity ≤ 4) OU intensity ≤ 2 → omnivore
//   6. retour { key, runnerUp }
//
// Parité vérifiée par fixtures générées avec le moteur JS du quiz lui-même
// (`app/scripts/gen-archetype-fixtures.mjs`) — voir
// `__tests__/archetype-engine.test.ts`.

import type { UserPalais } from "../types/palais";

/** Clés canoniques des 13 archétypes — identiques aux clés du quiz. */
export const ARCHETYPE_KEYS = [
  "omnivore",
  "gardien",
  "ancre",
  "bouchedor",
  "braise",
  "memoire",
  "pisteur",
  "vent",
  "fantome",
  "murmure",
  "oeil",
  "lame",
  "passeport",
] as const;

export type ArchetypeKey = (typeof ARCHETYPE_KEYS)[number];

/** Type guard — utile pour valider `quiz_archetype` venant de la DB / du réseau. */
export function isArchetypeKey(v: unknown): v is ArchetypeKey {
  return typeof v === "string" && (ARCHETYPE_KEYS as readonly string[]).includes(v);
}

/** Codes courts des 5 axes, échelle quiz [-2, +2]. */
export type QuizAxisCode = "R" | "T" | "E" | "F" | "M";

/** Vecteur d'axes en échelle quiz. */
export type QuizAxes = Record<QuizAxisCode, number>;

/** Un pôle d'archétype : [axe, signe du pôle] — ex. ["T", -1] = Tanière. */
export type ArchetypePole = readonly [QuizAxisCode, 1 | -1];

/**
 * Paires d'axes des 12 archétypes « à paire » (omnivore n'en a pas).
 * ⚠️ L'ORDRE DE DÉCLARATION EST SIGNIFIANT : il reproduit l'ordre d'itération
 * de `for (const key in ARCHETYPES)` du quiz, qui départage les égalités
 * parfaites via la stabilité du tri. Ne pas réordonner.
 */
export const ARCHETYPE_PAIRS: ReadonlyArray<{
  key: Exclude<ArchetypeKey, "omnivore">;
  pair: readonly [ArchetypePole, ArchetypePole];
}> = [
  { key: "gardien", pair: [["T", -1], ["M", -1]] },
  { key: "ancre", pair: [["T", -1], ["M", 1]] },
  { key: "bouchedor", pair: [["T", 1], ["M", 1]] },
  { key: "braise", pair: [["F", -1], ["E", 1]] },
  { key: "memoire", pair: [["T", -1], ["R", -1]] },
  { key: "pisteur", pair: [["T", 1], ["M", -1]] },
  { key: "vent", pair: [["R", 1], ["T", 1]] },
  { key: "fantome", pair: [["T", 1], ["F", 1]] },
  { key: "murmure", pair: [["F", 1], ["M", -1]] },
  { key: "oeil", pair: [["F", 1], ["E", -1]] },
  { key: "lame", pair: [["M", 1], ["E", -1]] },
  { key: "passeport", pair: [["M", 1], ["R", 1]] },
] as const;

export interface ArchetypeResult {
  key: ArchetypeKey;
  /** 2e archétype le mieux classé — null si un seul candidat pertinent. */
  runnerUp: ArchetypeKey | null;
  /** Axes clampés [-2, 2] réellement utilisés pour le calcul (debug/analytics). */
  axes: QuizAxes;
}

/** Sous-ensemble des 5 axes du Palais (même shape que `dominantAxes()`). */
export type PalaisAxesInput = Pick<
  UserPalais,
  | "axe_racines_horizons"
  | "axe_taniere_nomade"
  | "axe_exigeant_enthousiaste"
  | "axe_foule_secret"
  | "axe_maquis_table"
>;

/**
 * Conversion Palais app [-1, +1] → axes quiz [-2, +2].
 * Linéaire ×2 puis clamp — aucun axe inversé (voir tableau de polarité en tête).
 */
export function palaisToQuizAxes(p: PalaisAxesInput): QuizAxes {
  return {
    R: clamp2(p.axe_racines_horizons * 2),
    T: clamp2(p.axe_taniere_nomade * 2),
    E: clamp2(p.axe_exigeant_enthousiaste * 2),
    F: clamp2(p.axe_foule_secret * 2),
    M: clamp2(p.axe_maquis_table * 2),
  };
}

/**
 * Port fidèle de `computeArchetype()` du quiz (jeu.html l.757-767).
 * Entrée : axes en échelle quiz (les valeurs hors [-2,2] sont clampées comme
 * dans le quiz, où les loads de questions peuvent s'accumuler au-delà).
 */
export function computeArchetype(scores: QuizAxes): ArchetypeResult {
  const cl: QuizAxes = {
    R: clamp2(scores.R),
    T: clamp2(scores.T),
    E: clamp2(scores.E),
    F: clamp2(scores.F),
    M: clamp2(scores.M),
  };

  const align = (pole: ArchetypePole): number => Math.max(0, cl[pole[0]] * pole[1]);

  const ranked = ARCHETYPE_PAIRS.map(({ key, pair }) => {
    const A = align(pair[0]);
    const B = align(pair[1]);
    const both = A > 0 && B > 0;
    const sc = both ? A + B + Math.min(A, B) * 0.6 : (A + B) * 0.4;
    return { key, sc, A, B, mn: Math.min(A, B) };
  });
  // Tri stable (ES2019) — l'ordre de ARCHETYPE_PAIRS départage les égalités.
  ranked.sort((x, y) => y.sc - x.sc || y.mn - x.mn);

  // ARCHETYPE_PAIRS est non vide par construction — top existe toujours.
  const top = ranked[0]!;
  const intensity =
    Math.abs(cl.R) + Math.abs(cl.T) + Math.abs(cl.E) + Math.abs(cl.F) + Math.abs(cl.M);
  const noClean = top.A === 0 || top.B === 0;

  // Garde-fous omnivore — profil plat OU aucune paire franche.
  if ((noClean && intensity <= 4) || intensity <= 2) {
    return { key: "omnivore", axes: cl, runnerUp: top.key };
  }
  return { key: top.key, axes: cl, runnerUp: ranked[1]?.key ?? null };
}

/** Raccourci : Palais app [-1,+1] → archétype (conversion + calcul). */
export function computeArchetypeFromPalais(p: PalaisAxesInput): ArchetypeResult {
  return computeArchetype(palaisToQuizAxes(p));
}

function clamp2(v: number): number {
  return Math.max(-2, Math.min(2, v));
}
