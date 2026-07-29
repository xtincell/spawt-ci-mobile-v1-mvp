// Story 4.6 — Mapping signaux avis → 5 axes Palais (PRD §20.5).
// Source canonique : PRD §20.5 — figé.
// V1 : 13-15 entrées (vs 13 PRD strict). Snapshot fige la version livrée.
//
// API publique :
//   - TAG_TO_SIGNALS, PLACE_SIGNAL_TO_SIGNALS : maps de référence
//   - noteToSignals(note) : signal dérivé de la note
//   - applyReviewToPalais({ current, unique_spots, note, tags, place_signals }) :
//     pure helper qui calcule le nouveau Palais (post-update). Caller persist.

import {
  computeConfidence,
  dominantAxes,
  updateAxis,
} from "./palais-engine";
import { track } from "./analytics";
import type { PalaisAxis, UserPalais } from "../types/palais";
import type { ReviewTag } from "../types/spawt";

export type SignalDirection = 1 | -1;

export interface PalaisSignal {
  axis: PalaisAxis;
  direction: SignalDirection;
  /** Poids absolu (avant learningFactor). PRD §20.5 typique 0.02 (faible) → 0.04 (fort). */
  weight: number;
}

/** Mapping ReviewTag → signaux multiples (un tag peut influencer plusieurs axes). */
export const TAG_TO_SIGNALS: Record<ReviewTag, readonly PalaisSignal[]> = {
  copieux: [
    { axis: "maquis_table", direction: -1, weight: 0.03 },
    { axis: "exigeant_enthousiaste", direction: 1, weight: 0.02 },
  ],
  rapide: [
    { axis: "taniere_nomade", direction: 1, weight: 0.02 },
    { axis: "maquis_table", direction: -1, weight: 0.02 },
  ],
  ambiance_top: [
    { axis: "foule_secret", direction: -1, weight: 0.03 },
    { axis: "exigeant_enthousiaste", direction: 1, weight: 0.02 },
  ],
  cher: [
    { axis: "maquis_table", direction: 1, weight: 0.04 },
    { axis: "exigeant_enthousiaste", direction: -1, weight: 0.02 },
  ],
  a_refaire: [
    { axis: "taniere_nomade", direction: -1, weight: 0.03 },
    { axis: "exigeant_enthousiaste", direction: 1, weight: 0.03 },
  ],
};

/** Mapping `Place.signals` (PlaceSignal) → axes Palais. */
export const PLACE_SIGNAL_TO_SIGNALS: Record<string, readonly PalaisSignal[]> = {
  institution: [
    { axis: "racines_horizons", direction: -1, weight: 0.04 },
    { axis: "maquis_table", direction: 1, weight: 0.02 },
  ],
  decouverte: [
    { axis: "taniere_nomade", direction: 1, weight: 0.03 },
    { axis: "foule_secret", direction: 1, weight: 0.02 },
  ],
  noctambule_verifie: [
    { axis: "taniere_nomade", direction: 1, weight: 0.02 },
  ],
};

/** Signal dérivé de la note. Note 3 = neutre (aucun signal). */
export function noteToSignals(
  note_etoiles: 1 | 2 | 3 | 4 | 5,
): readonly PalaisSignal[] {
  if (note_etoiles === 3) return [];
  const direction: SignalDirection = note_etoiles >= 4 ? 1 : -1;
  const weight = note_etoiles === 5 || note_etoiles === 1 ? 0.04 : 0.02;
  return [{ axis: "exigeant_enthousiaste", direction, weight }];
}

/** Compte total figé (snapshot stable). */
export const TOTAL_SIGNAL_MAPPINGS =
  Object.values(TAG_TO_SIGNALS).reduce((sum, arr) => sum + arr.length, 0) +
  Object.values(PLACE_SIGNAL_TO_SIGNALS).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

export interface ApplyReviewToPalaisInput {
  current: UserPalais;
  unique_spots: number;
  note: 1 | 2 | 3 | 4 | 5;
  tags: readonly string[];
  place_signals: readonly string[];
}

export interface ApplyReviewToPalaisOutput {
  palais: UserPalais;
  didUpdate: boolean;
}

/**
 * Applique un avis (note + tags + place_signals) au Palais courant.
 * Pure — sans I/O. Le caller (store) persiste et émet l'event.
 *
 * - Tags inconnus → skip silencieux.
 * - Note 3 + tags [] + signals [] → no-op (didUpdate = false).
 * - Cumul de signaux sur le même axe : appliqués séquentiellement (clamped [-1, 1]).
 * - confidence_score recalculé via computeConfidence(unique_spots).
 * - dominant_axes recalculé via dominantAxes.
 */
export function applyReviewToPalais(
  input: ApplyReviewToPalaisInput,
): ApplyReviewToPalaisOutput {
  const signals = [
    ...noteToSignals(input.note),
    ...input.tags.flatMap((t) => TAG_TO_SIGNALS[t as ReviewTag] ?? []),
    ...input.place_signals.flatMap(
      (s) => PLACE_SIGNAL_TO_SIGNALS[s] ?? [],
    ),
  ];
  if (signals.length === 0) {
    return { palais: input.current, didUpdate: false };
  }

  const axes = {
    axe_racines_horizons: input.current.axe_racines_horizons,
    axe_taniere_nomade: input.current.axe_taniere_nomade,
    axe_exigeant_enthousiaste: input.current.axe_exigeant_enthousiaste,
    axe_foule_secret: input.current.axe_foule_secret,
    axe_maquis_table: input.current.axe_maquis_table,
  };

  for (const s of signals) {
    const key = `axe_${s.axis}` as keyof typeof axes;
    axes[key] = updateAxis(
      axes[key],
      s.direction * s.weight,
      input.unique_spots,
    );
  }

  const updated: UserPalais = {
    ...input.current,
    ...axes,
    confidence_score: computeConfidence(input.unique_spots),
    dominant_axes: dominantAxes(axes),
    updated_at: new Date().toISOString(),
  };

  // Émet `palais_updated` (PRD §16.1, events.md §9 Stade & Palais).
  try {
    track({
      name: "palais_updated",
      properties: {
        confidence_score: updated.confidence_score,
        dominant_axes: updated.dominant_axes ?? [],
        total_spawts: updated.total_spawts,
      },
    });
  } catch (err) {
    if (__DEV__) console.warn("[palais-signals] track palais_updated failed", err);
  }

  return { palais: updated, didUpdate: true };
}
