// Story 5.4 — Helper barre de progression vers le prochain seuil de stade.
// Pure helper, sans I/O. Tests unit dans __tests__/stade-progress.test.ts.

import { STADES, STADE_DESCRIPTORS, type Stade } from "../types/stade";

export interface StadeProgress {
  current_stade: Stade;
  current_count: number;
  next_stade: Stade | null;
  next_threshold: number | null;
  /** Pourcentage progression [0, 1] vers le prochain seuil. */
  percent: number;
}

export function getNextStadeProgress(stade: Stade, uniqueSpots: number): StadeProgress {
  const idx = STADES.indexOf(stade);
  const currentDesc = STADE_DESCRIPTORS[stade];
  const next = idx < STADES.length - 1 ? STADES[idx + 1] : undefined;
  if (!next) {
    return {
      current_stade: stade,
      current_count: uniqueSpots,
      next_stade: null,
      next_threshold: null,
      percent: 1,
    };
  }
  const nextDesc = STADE_DESCRIPTORS[next];
  const range = nextDesc.min - currentDesc.min;
  const raw = (uniqueSpots - currentDesc.min) / Math.max(1, range);
  const percent = Math.max(0, Math.min(1, raw));
  return {
    current_stade: stade,
    current_count: uniqueSpots,
    next_stade: next,
    next_threshold: nextDesc.min,
    percent,
  };
}
