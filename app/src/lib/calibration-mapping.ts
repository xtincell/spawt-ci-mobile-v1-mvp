// Calibration mapping — moteur pur (Story 2.5).
//
// Mappe les cartes sélectionnées par l'utilisateur sur une direction
// (`neg` | `pos` | `neutral`) qui sera convertie en delta -0.4 / 0 / +0.4
// via `calibrationDelta()` du spawter-store.
//
// Sans I/O — testable unit pure.

import type { PalaisAxis } from "../types/palais";

export type Polarity = "neg" | "pos";
export type Direction = "neg" | "pos" | "neutral";

export interface CalibrationCard {
  /** ID stable pour key React + i18n */
  altKey: string;
  /** Clé i18n FR pour le label affiché */
  labelKey: string;
  /** Clé i18n FR optionnelle pour le sous-label */
  subKey?: string;
  /** Pôle de la carte. Une carte est figée à un pôle, pas calculée. */
  polarity: Polarity;
}

export interface CalibrationQuestion {
  axis: PalaisAxis;
  cards: readonly CalibrationCard[];
}

/**
 * Résout la direction selon les cartes sélectionnées :
 *   - 0 carte → "neutral" (l'utilisateur passe sans avis)
 *   - toutes neg → "neg"
 *   - toutes pos → "pos"
 *   - mix → "neutral"
 */
export function resolveDirection(
  selectedIndices: readonly number[],
  cards: readonly CalibrationCard[],
): Direction {
  if (selectedIndices.length === 0) return "neutral";
  const polarities = new Set<Polarity>();
  for (const idx of selectedIndices) {
    const card = cards[idx];
    if (card) polarities.add(card.polarity);
  }
  if (polarities.size !== 1) return "neutral";
  return polarities.has("neg") ? "neg" : "pos";
}

// ━━━ Catalogue canonique V1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Labels via clés i18n — fr.json `calibration.q_<axis>.card.<altKey>`.

export const CALIBRATION_QUESTIONS: readonly CalibrationQuestion[] = [
  {
    axis: "racines_horizons",
    cards: [
      { altKey: "garba", labelKey: "calibration.q_racines_horizons.card.garba", polarity: "neg" },
      { altKey: "placali", labelKey: "calibration.q_racines_horizons.card.placali", polarity: "neg" },
      { altKey: "poulet_braise", labelKey: "calibration.q_racines_horizons.card.poulet_braise", polarity: "neg" },
      { altKey: "burger", labelKey: "calibration.q_racines_horizons.card.burger", polarity: "pos" },
      { altKey: "ramen", labelKey: "calibration.q_racines_horizons.card.ramen", polarity: "pos" },
      { altKey: "patisseries", labelKey: "calibration.q_racines_horizons.card.patisseries", polarity: "pos" },
    ],
  },
  {
    axis: "taniere_nomade",
    cards: [
      { altKey: "spot_pref", labelKey: "calibration.q_taniere_nomade.card.spot_pref", polarity: "neg" },
      { altKey: "deux_trois", labelKey: "calibration.q_taniere_nomade.card.deux_trois", polarity: "neg" },
      { altKey: "nouvelle_adresse", labelKey: "calibration.q_taniere_nomade.card.nouvelle_adresse", polarity: "pos" },
      { altKey: "teste_tout", labelKey: "calibration.q_taniere_nomade.card.teste_tout", polarity: "pos" },
    ],
  },
  {
    axis: "exigeant_enthousiaste",
    cards: [
      { altKey: "service_compte", labelKey: "calibration.q_exigeant_enthousiaste.card.service_compte", polarity: "neg" },
      { altKey: "bon_pardonne", labelKey: "calibration.q_exigeant_enthousiaste.card.bon_pardonne", polarity: "pos" },
      { altKey: "ambiance_fait", labelKey: "calibration.q_exigeant_enthousiaste.card.ambiance_fait", polarity: "pos" },
      { altKey: "note_tout", labelKey: "calibration.q_exigeant_enthousiaste.card.note_tout", polarity: "neg" },
    ],
  },
  {
    axis: "foule_secret",
    cards: [
      { altKey: "maquis_bonde", labelKey: "calibration.q_foule_secret.card.maquis_bonde", polarity: "neg" },
      { altKey: "spot_anime", labelKey: "calibration.q_foule_secret.card.spot_anime", polarity: "neg" },
      { altKey: "spot_cache", labelKey: "calibration.q_foule_secret.card.spot_cache", polarity: "pos" },
      { altKey: "table_intime", labelKey: "calibration.q_foule_secret.card.table_intime", polarity: "pos" },
    ],
  },
  {
    axis: "maquis_table",
    cards: [
      { altKey: "maquis_garba", labelKey: "calibration.q_maquis_table.card.maquis_garba", polarity: "neg" },
      { altKey: "foodtruck", labelKey: "calibration.q_maquis_table.card.foodtruck", polarity: "neg" },
      { altKey: "restaurant_chic", labelKey: "calibration.q_maquis_table.card.restaurant_chic", polarity: "pos" },
      { altKey: "brunch_cocody", labelKey: "calibration.q_maquis_table.card.brunch_cocody", polarity: "pos" },
    ],
  },
];
