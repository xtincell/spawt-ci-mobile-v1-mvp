// Story 4.7 — Mapping signaux avis → 5 axes ADN (PRD §6 + §20.5).
// **Différent** du mapping Palais Story 4.6 (axes différents !).

import type { ReviewTag } from "../types/spawt";

/** Les 5 axes ADN (PRD §6.1). */
export type AdnAxisKey =
  | "axe_local_international"
  | "axe_informel_etabli"
  | "axe_budget_premium"
  | "axe_populaire_prive"
  | "axe_decontracte_habille";

export interface AdnSignal {
  axis: AdnAxisKey;
  direction: 1 | -1;
  /** Poids absolu (0.01-0.05). PRD §20.5. */
  weight: number;
}

/** Mapping ReviewTag → signaux ADN. */
export const TAG_TO_ADN_SIGNALS: Record<ReviewTag, readonly AdnSignal[]> = {
  copieux: [
    { axis: "axe_informel_etabli", direction: -1, weight: 0.03 },
    { axis: "axe_budget_premium", direction: -1, weight: 0.02 },
  ],
  rapide: [
    { axis: "axe_informel_etabli", direction: -1, weight: 0.03 },
    { axis: "axe_decontracte_habille", direction: -1, weight: 0.02 },
  ],
  ambiance_top: [
    { axis: "axe_populaire_prive", direction: -1, weight: 0.03 },
    { axis: "axe_decontracte_habille", direction: 1, weight: 0.02 },
  ],
  cher: [
    { axis: "axe_budget_premium", direction: 1, weight: 0.04 },
    { axis: "axe_informel_etabli", direction: 1, weight: 0.02 },
  ],
  a_refaire: [
    { axis: "axe_populaire_prive", direction: -1, weight: 0.02 },
  ],
};

/** Mapping note → 1 signal sur `axe_decontracte_habille` (proxy de qualité ressentie). */
export function noteToAdnSignals(
  note: 1 | 2 | 3 | 4 | 5,
): readonly AdnSignal[] {
  if (note === 3) return [];
  const direction: 1 | -1 = note >= 4 ? 1 : -1;
  const weight = note === 5 || note === 1 ? 0.03 : 0.02;
  return [{ axis: "axe_decontracte_habille", direction, weight }];
}

export const TOTAL_ADN_SIGNAL_MAPPINGS =
  Object.values(TAG_TO_ADN_SIGNALS).reduce((sum, arr) => sum + arr.length, 0);
