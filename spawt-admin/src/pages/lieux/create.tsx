// Console admin 07/2026 — la création de lieu accepte un état routeur posé
// par la page Suggestions (approbation 0039) : prefill + suggestionId.
// Navigation directe (sans state) = création vierge, comportement historique.

import { useLocation } from "react-router";
import { PlaceForm } from "../../components/PlaceForm";
import type { SuggestionApprovalState } from "../suggestions/logic";

export const LieuCreate = () => {
  const location = useLocation();
  const state = (location.state ?? null) as SuggestionApprovalState | null;
  return (
    <PlaceForm
      mode="create"
      prefill={state?.prefill}
      suggestionId={state?.suggestionId}
    />
  );
};
