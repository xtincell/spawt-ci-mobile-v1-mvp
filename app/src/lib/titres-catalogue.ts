// PRD §3.1 FR-008 + §5.4 — Catalogue des titres Sprint 1 + archétypes.
// Sprint 1 = 5 titres de base (1 par stade) + 1 badge bonus `Premier Spawt` (D4).
// Chantier 13 archétypes (PRD final §5.5/§6.3) : les 13 titres d'archétype
// (`title.archetype.<key>`) entrent dans la collection à l'assignation
// initiale et à chaque mue — mémoire d'identité, PAS un trophée.
//
// ⚠️ Source DB : la CHECK constraint de `collection_titres.source`
// (migration 0014) n'accepte que 'stade' | 'badge'. Les titres d'archétype
// sont donc insérés avec source='badge' (le title_key `title.archetype.*`
// suffit à les distinguer). Ne pas ajouter 'archetype' au type sans migration.

import type { Stade } from "../types/stade";
import { ARCHETYPE_TITLE_KEYS } from "../data/archetypes";

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

/** Vérifie qu'une clé est connue du catalogue (anti-typo + anti-drift).
 *  Couvre : 5 titres de stade + badge Premier Spawt + 13 titres d'archétype. */
export function isKnownTitleKey(key: string): boolean {
  return (
    Object.values(STADE_TITLE_KEYS).includes(key) ||
    key === PREMIER_SPAWT_TITLE_KEY ||
    ARCHETYPE_TITLE_KEYS.includes(key)
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
