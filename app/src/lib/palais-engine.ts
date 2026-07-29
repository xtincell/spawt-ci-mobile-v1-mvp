// Moteur du Palais — PRD §5.6
// Calibrage initial : 5 questions → scores [-0.40, +0.40] sur 5 axes
// Mise à jour continue : décroissance exponentielle pour stabiliser le Palais
//
// Politique : overwrite (amendement team 4.6). Pas d'historique en MVP.

import type { PalaisAxis, UserPalais } from "../types/palais";
import { PALAIS_AXES } from "../types/palais";

/**
 * Délai d'apprentissage selon le nombre de spots uniques (PRD §5.6).
 * Plus de spots → moins d'inertie sur chaque nouvelle observation.
 */
export function learningFactor(uniqueSpots: number): number {
  return Math.max(0.05, 1.0 / (1 + uniqueSpots * 0.05));
}

/**
 * Met à jour un axe du Palais avec un signal observé.
 * Signal typique : +0.02 (faible), +0.04 (fort) — voir PRD §20.5 mapping.
 *
 * @param oldScore  Valeur actuelle [-1, 1]
 * @param signal    Direction et amplitude du signal
 * @param uniqueSpots  Nombre de spots uniques du spawter
 * @returns nouvelle valeur clampée [-1, 1]
 */
export function updateAxis(
  oldScore: number,
  signal: number,
  uniqueSpots: number,
): number {
  const factor = learningFactor(uniqueSpots);
  const delta = signal * factor;
  return clamp(oldScore + delta, -1, 1);
}

/**
 * Confidence score (PRD §5.6) — fiabilité du Palais.
 * <0.3 → afficher "ADN en construction" (Stéphanie : ne pas mentir au user).
 */
export function computeConfidence(uniqueSpots: number): number {
  // Approximation : 0 spawts → 0, 50 spawts → ~0.7, 100+ → ~0.85
  return clamp(1 - 1 / (1 + uniqueSpots * 0.05), 0, 1);
}

/**
 * Détermine les 2 axes dominants (PRD §5.1).
 * L'axe avec la plus grande valeur absolue est le 1er ; le 2e suit.
 */
export function dominantAxes(palais: Pick<UserPalais, "axe_racines_horizons" | "axe_taniere_nomade" | "axe_exigeant_enthousiaste" | "axe_foule_secret" | "axe_maquis_table">): [PalaisAxis, PalaisAxis] | null {
  const scores: Array<{ axis: PalaisAxis; abs: number }> = [
    { axis: "racines_horizons", abs: Math.abs(palais.axe_racines_horizons) },
    { axis: "taniere_nomade", abs: Math.abs(palais.axe_taniere_nomade) },
    { axis: "exigeant_enthousiaste", abs: Math.abs(palais.axe_exigeant_enthousiaste) },
    { axis: "foule_secret", abs: Math.abs(palais.axe_foule_secret) },
    { axis: "maquis_table", abs: Math.abs(palais.axe_maquis_table) },
  ];
  scores.sort((a, b) => b.abs - a.abs);
  // Si profil trop plat (omnivore candidate), pas de dominant
  if ((scores[0]?.abs ?? 0) < 0.1) return null;
  return [scores[0]!.axis, scores[1]!.axis];
}

/**
 * Vecteur normalisé pour calcul de cosine similarity (PRD §8.2 dim 1).
 * Ordre fixe : PALAIS_AXES.
 */
export function palaisVector(p: UserPalais): number[] {
  return [
    p.axe_racines_horizons,
    p.axe_taniere_nomade,
    p.axe_exigeant_enthousiaste,
    p.axe_foule_secret,
    p.axe_maquis_table,
  ];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Sanity check à l'import (dev only)
if (__DEV__) {
  if (PALAIS_AXES.length !== 5) {
    throw new Error("PALAIS_AXES doit avoir exactement 5 entrées (PRD §5.1)");
  }
}
