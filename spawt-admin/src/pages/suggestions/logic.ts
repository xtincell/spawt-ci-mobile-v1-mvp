// Console admin 07/2026 — logique pure de la page Suggestions de lieux
// (testable sans Refine). Table place_suggestions (migration 0039) : la Meute
// propose un spot, le staff approuve (création de fiche pré-remplie) ou
// rejette avec motif.

import type { PlaceForm as PlaceFormValues } from "../../types/place.schema";

export interface SuggestionRow {
  id: string;
  spawter_id: string;
  name: string;
  neighborhood: string | null;
  commune: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  photo_urls: string[];
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_place_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  spawters?: { display_name: string } | null;
}

/** État routeur passé à /lieux/create par « Approuver ». */
export interface SuggestionApprovalState {
  suggestionId: string;
  prefill: Partial<PlaceFormValues>;
}

export const STATUS_LABELS: Record<SuggestionRow["status"], string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
};

/**
 * Suggestion → pré-remplissage du formulaire de création de lieu.
 * - commune : mappée sur le champ quartier canonique du formulaire si elle
 *   correspond (insensible casse/espaces) ; sinon reportée dans l'adresse
 *   descriptive pour ne rien perdre.
 * - neighborhood (le quartier précis suggéré) + description → adresse
 *   descriptive (le staff nettoie avant publication).
 * - photos de la suggestion → galerie de la fiche.
 */
export function suggestionToPrefill(
  s: SuggestionRow,
  knownNeighborhoods: readonly string[],
): Partial<PlaceFormValues> {
  const matched = s.commune
    ? knownNeighborhoods.find(
        (n) => n.trim().toLowerCase() === (s.commune as string).trim().toLowerCase(),
      )
    : undefined;

  const addressParts: string[] = [];
  if (s.neighborhood?.trim()) addressParts.push(s.neighborhood.trim());
  if (!matched && s.commune?.trim()) addressParts.push(s.commune.trim());
  if (s.description?.trim()) addressParts.push(s.description.trim());

  const prefill: Partial<PlaceFormValues> = {
    name: s.name,
    gallery_urls: s.photo_urls ?? [],
  };
  const location: Partial<PlaceFormValues["location"]> = {};
  if (typeof s.lat === "number" && typeof s.lng === "number") {
    location.lat = s.lat;
    location.lng = s.lng;
  }
  if (matched) location.neighborhood = matched;
  if (addressParts.length > 0) location.descriptive_address = addressParts.join(" — ");
  if (Object.keys(location).length > 0) {
    prefill.location = location as PlaceFormValues["location"];
  }
  return prefill;
}

/** Payload de rejet — reviewed_by/reviewed_at auto-populés par le trigger 0039
 *  (défense en profondeur, pattern signalements/buildResolutionPayload). */
export function buildRejectionPayload(reason: string): Record<string, unknown> {
  return {
    status: "rejected",
    rejection_reason: reason,
  };
}
