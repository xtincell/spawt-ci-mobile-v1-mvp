import type { ModeKey } from "../components/ModeStories";
import type { PlaceWithScore } from "./matching";

/** Existing inventory signals only; no invented visit history or daily rotation. */
export function selectHomeEditorial(
  ranked: readonly PlaceWithScore[],
  mode: ModeKey
): PlaceWithScore[] {
  switch (mode) {
    case "suggestions":
      return ranked.slice(0, 3);
    case "traine":
      return ranked
        .filter(
          ({ place, adn }) =>
            place.price.tier <= 2 && adn.axe_decontracte_habille < 0
        )
        .slice(0, 3);
    case "decouvre":
      return ranked
        .filter(({ adn }) => adn.axe_populaire_prive > 0)
        .slice(0, 3);
    case "selections":
      return [];
  }
}
