#!/usr/bin/env node
// Générateur de fixtures de PARITÉ pour archetype-engine.ts (chantier 13 archétypes).
//
// Principe : on extrait la fonction `computeArchetype()` et la constante
// `ARCHETYPES` DU QUIZ LUI-MÊME (repo spawt-meute-quiz, public/jeu.html) par
// découpage textuel, on l'évalue en Node, puis on exécute une batterie de
// vecteurs d'entrée représentatifs (échelle quiz [-2,+2] par axe R/T/E/F/M).
// La sortie JSON sert de vérité terrain aux tests jest
// (`src/lib/__tests__/archetype-engine.test.ts` — fixtures recopiées en dur,
// avec provenance commentée, pour que la gate tourne sans le repo quiz).
//
// Usage :
//   node scripts/gen-archetype-fixtures.mjs [chemin/vers/jeu.html]
//   (défaut : ../../spawt-meute-quiz/public/jeu.html relativement à app/)
//
// Ce script N'EST PAS dans la gate — c'est un outil de re-génération si le
// moteur du quiz évolue (re-synchroniser les fixtures alors).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const htmlPath =
  process.argv[2] ?? join(ROOT, "..", "..", "spawt-meute-quiz", "public", "jeu.html");

const html = readFileSync(htmlPath, "utf8");

// ── Extraction textuelle : const ARCHETYPES={...}; + function computeArchetype(){...}
function sliceBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`marqueur introuvable: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error(`fin introuvable après: ${startMarker}`);
  return src.slice(start, end);
}

const archetypesSrc = sliceBlock(html, "const ARCHETYPES={", "\n\n/* ── MENUS");
const computeSrc = sliceBlock(html, "function computeArchetype(){", "function validEmail");

// `computeArchetype` du quiz lit `scores` global — on l'injecte par closure.
// eslint-disable-next-line no-new-func
const factory = new Function(
  "scores",
  `${archetypesSrc}\n${computeSrc}\nreturn computeArchetype();`,
);

function reference(scores) {
  return factory(scores);
}

// ── Vecteurs représentatifs (échelle quiz [-2,+2]) ──────────────────────────
// Couvre : les 12 archétypes à paire (axes purs), les 2 garde-fous omnivore
// (intensity<=2 ; noClean && intensity<=4), le cas calibration ±0.8 (app ±0.4
// converti ×2), un tie-break stable-sort, et des profils mixtes réalistes.
const VECTORS = [
  { label: "gardien pur (T-2 M-2)", scores: { R: 0, T: -2, E: 0, F: 0, M: -2 } },
  { label: "ancre pur (T-2 M+2)", scores: { R: 0, T: -2, E: 0, F: 0, M: 2 } },
  { label: "bouchedor pur (T+2 M+2)", scores: { R: 0, T: 2, E: 0, F: 0, M: 2 } },
  { label: "braise pur (F-2 E+2)", scores: { R: 0, T: 0, E: 2, F: -2, M: 0 } },
  { label: "memoire pur (T-2 R-2)", scores: { R: -2, T: -2, E: 0, F: 0, M: 0 } },
  { label: "pisteur pur (T+2 M-2)", scores: { R: 0, T: 2, E: 0, F: 0, M: -2 } },
  { label: "vent pur (R+2 T+2)", scores: { R: 2, T: 2, E: 0, F: 0, M: 0 } },
  { label: "fantome pur (T+2 F+2)", scores: { R: 0, T: 2, E: 0, F: 2, M: 0 } },
  { label: "murmure pur (F+2 M-2)", scores: { R: 0, T: 0, E: 0, F: 2, M: -2 } },
  { label: "oeil pur (F+2 E-2)", scores: { R: 0, T: 0, E: -2, F: 2, M: 0 } },
  { label: "lame pur (M+2 E-2)", scores: { R: 0, T: 0, E: -2, F: 0, M: 2 } },
  { label: "passeport pur (M+2 R+2)", scores: { R: 2, T: 0, E: 0, F: 0, M: 2 } },
  { label: "omnivore intensity 0", scores: { R: 0, T: 0, E: 0, F: 0, M: 0 } },
  { label: "omnivore intensity 2 (R-1 M-1)", scores: { R: -1, T: 0, E: 0, F: 0, M: -1 } },
  { label: "omnivore noClean intensity 4 (R-2 F-2)", scores: { R: -2, T: 0, E: 0, F: -2, M: 0 } },
  { label: "clean pair à intensity 4 exactement (calibration ±0.8 gardien/braise tie)", scores: { R: -0.8, T: -0.8, E: 0.8, F: -0.8, M: -0.8 } },
  { label: "clamp au-delà de ±2 (accumulation quiz)", scores: { R: -3, T: -4, E: 1, F: -1, M: -3 } },
  { label: "mixte réaliste pisteur vs murmure", scores: { R: -1, T: 2, E: 0, F: 1, M: -2 } },
  { label: "mixte réaliste vent vs passeport", scores: { R: 2, T: 1, E: 0, F: 0, M: 2 } },
  { label: "calibration ±0.8 fantome (T+0.8 F+0.8)", scores: { R: 0, T: 0.8, E: 0, F: 0.8, M: 0 } },
];

const fixtures = VECTORS.map(({ label, scores }) => {
  const out = reference({ ...scores });
  return { label, scores, expected: { key: out.key, runnerUp: out.runnerUp } };
});

console.log(JSON.stringify(fixtures, null, 2));
