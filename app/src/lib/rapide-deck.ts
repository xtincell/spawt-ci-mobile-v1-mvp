// Mode Rapide — construction du deck de swipe (feature post-MVP #1).
//
// Le deck réutilise le MÊME moteur que le feed (rankPlaces, poids PRD §8.1)
// sur la MÊME source de lieux (listPlaces via data-source) — zéro divergence
// de scoring entre le feed et le swipe. Les lieux déjà sauvegardés sont
// exclus : swiper un favori n'apporte aucun signal supplémentaire.
//
// Pure, totale, sans I/O — même contrat de testabilité que matching.ts.

import {
  rankPlaces,
  toPlaceWithSignals,
  type MatchingContext,
  type PlaceWithScore,
} from "./matching";
import type { PlaceWithAdn } from "./data-source";

/**
 * Construit le deck du Mode Rapide : lieux du feed courant, rankés par le
 * score composite canonique, favoris exclus.
 * L'ordre de swipe = l'ordre de matching (meilleur match en premier).
 */
export function buildRapideDeck(
  places: readonly PlaceWithAdn[],
  ctx: MatchingContext,
): PlaceWithScore[] {
  const candidates = places.filter((p) => !ctx.saved_place_ids.has(p.id));
  return rankPlaces(
    ctx,
    candidates.map(toPlaceWithSignals),
  );
}
