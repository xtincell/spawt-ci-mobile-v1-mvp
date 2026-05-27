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

/** Ordre canonique des stades (PRD §5.2). Source unique pour les boucles
 *  "stades entre X et Y" (Story 5.2 M8 — unlock intermédiaires sur saut). */
export const STADE_ORDER: readonly Stade[] = [
  "touriste",
  "explorateur",
  "detective",
  "djidji",
  "guide",
] as const;

/** Retourne les clés des titres de stades **strictement entre** prev et next
 *  (next inclus, prev exclu). Si prev === next, retourne []. Garantit qu'un
 *  user qui saute touriste → detective récupère bien `title.explorateur` +
 *  `title.detective` dans sa collection. */
export function stadeTitleKeysBetween(prev: Stade, next: Stade): string[] {
  const prevIdx = STADE_ORDER.indexOf(prev);
  const nextIdx = STADE_ORDER.indexOf(next);
  if (prevIdx < 0 || nextIdx < 0 || nextIdx <= prevIdx) return [];
  const out: string[] = [];
  for (let i = prevIdx + 1; i <= nextIdx; i++) {
    const s = STADE_ORDER[i];
    if (s) out.push(STADE_TITLE_KEYS[s]);
  }
  return out;
}
