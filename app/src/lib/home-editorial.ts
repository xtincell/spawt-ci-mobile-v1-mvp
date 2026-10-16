import type { ModeKey } from "../components/ModeStories";
import type { PlaceWithScore } from "./matching";

/** Suggestions retain the canonical ranking. Other usages have their own sources. */
export function selectHomeEditorial(
  ranked: readonly PlaceWithScore[],
  mode: ModeKey,
): PlaceWithScore[] {
  return mode === "suggestions" ? ranked.slice(0, 3) : [];
}
