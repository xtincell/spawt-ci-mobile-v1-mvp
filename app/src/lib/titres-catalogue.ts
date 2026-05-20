// PRD §3.1 FR-008 + §5.4 — Catalogue des titres Sprint 1.
// Sprint 1 = 5 titres de base (1 par stade) + 1 badge bonus `Premier Spawt` (D4).
// V1.5+ ajoutera les titres d'archétype / de mue (PRD §6.3).

import type { Stade } from "../types/stade";

/** Source d'un titre (table `collection_titres.source`). */
export type TitleSource = "stade" | "badge";

export interface TitleDescriptor {
  /** Clé i18n complète (ex: `title.touriste`). */
  key: string;
  source: TitleSource;
}

/** Mapping stade → clé i18n du titre porté à ce stade. */
export const STADE_TITLE_KEYS: Record<Stade, string> = {
  touriste: "title.touriste",
  explorateur: "title.explorateur",
  detective: "title.detective",
  djidji: "title.djidji",
  guide: "title.guide",
};

/** Badge bonus Sprint 1 (drift D4 — pas d'autres jalons V1). */
export const PREMIER_SPAWT_TITLE_KEY = "title.premier_spawt";

/** Vérifie qu'une clé est connue du catalogue V1 (anti-typo + anti-drift). */
export function isKnownTitleKey(key: string): boolean {
  return (
    Object.values(STADE_TITLE_KEYS).includes(key) ||
    key === PREMIER_SPAWT_TITLE_KEY
  );
}

/** Helper : retourne le titre par défaut (= titre du stade actuel). */
export function defaultTitleKeyForStade(stade: Stade): string {
  return STADE_TITLE_KEYS[stade];
}
