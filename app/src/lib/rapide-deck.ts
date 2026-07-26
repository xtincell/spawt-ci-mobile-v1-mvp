// Mode Rapide — construction du deck de swipe (feature post-MVP #1).
//
// Le deck réutilise le MÊME moteur que le feed (rankPlaces, poids PRD §8.1)
// sur la MÊME source de lieux (listPlaces via data-source) — zéro divergence
// de scoring entre le feed et le swipe. Deux exclusions spécifiques au deck :
//   1. les lieux déjà sauvegardés — swiper un favori n'apporte aucun signal
//      (le « garde » est déjà acquis) ;
//   2. les lieux verrouillés par le paywall géographique quand le flag est
//      actif — décision produit : PAS de tease flou en plein swipe, un lieu
//      qu'on ne peut pas garder n'apparaît pas dans le deck.
//
// Pure, totale, sans I/O — même contrat de testabilité que matching.ts.

import {
  rankPlaces,
  type MatchingContext,
  type PlaceWithScore,
} from "./matching";
import { isPlaceLocked } from "./paywall-geo";
import type { PlaceWithAdn } from "./data-source";

/** Sous-ensemble paywall du contexte deck — miroir des params d'isPlaceLocked. */
export interface RapidePaywallContext {
  /** Flag `paywall-geo` actif (Phase 2 F14). */
  enabled: boolean;
  /** Spawter Gold : jamais verrouillé. */
  isGold: boolean;
  /** Position fallback (permission refusée) : jamais verrouillé — on ne punit
   *  pas l'absence de GPS (invariant paywall-geo.ts). */
  positionSource: "gps" | "fallback";
}

/**
 * Construit le deck du Mode Rapide : lieux du feed courant, rankés par le
 * score composite canonique, favoris et lieux hors zone paywall exclus.
 * L'ordre de swipe = l'ordre de matching (meilleur match en premier).
 */
export function buildRapideDeck(
  places: readonly PlaceWithAdn[],
  ctx: MatchingContext,
  paywall: RapidePaywallContext,
): PlaceWithScore[] {
  const candidates = places.filter(
    (p) =>
      !ctx.saved_place_ids.has(p.id) &&
      !isPlaceLocked({
        paywallEnabled: paywall.enabled,
        isGold: paywall.isGold,
        positionSource: paywall.positionSource,
        spawterLat: ctx.spawter_lat,
        spawterLng: ctx.spawter_lng,
        placeLat: p.location.lat,
        placeLng: p.location.lng,
      }),
  );
  return rankPlaces(
    ctx,
    candidates.map((p) => ({ place: p, adn: p.adn, last_spawt_at: null })),
  );
}
