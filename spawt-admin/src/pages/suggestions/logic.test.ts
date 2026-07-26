// Console admin 07/2026 — tests logique pure page Suggestions (0039).

import { describe, it, expect } from "vitest";
import { buildRejectionPayload, suggestionToPrefill, type SuggestionRow } from "./logic";

const NEIGHBORHOODS = ["Cocody", "Plateau", "Marcory", "Yopougon"];

function suggestion(partial: Partial<SuggestionRow>): SuggestionRow {
  return {
    id: "s1",
    spawter_id: "sp1",
    name: "Garba chez le Vieux",
    neighborhood: null,
    commune: null,
    description: null,
    lat: null,
    lng: null,
    photo_urls: [],
    status: "pending",
    rejection_reason: null,
    created_place_id: null,
    created_at: "2026-07-26T00:00:00Z",
    reviewed_at: null,
    spawters: null,
    ...partial,
  };
}

describe("suggestionToPrefill", () => {
  it("mappe nom + GPS + photos + commune connue vers le formulaire lieu", () => {
    const prefill = suggestionToPrefill(
      suggestion({
        commune: "  yopougon ",
        neighborhood: "Niangon",
        lat: 5.336,
        lng: -4.088,
        photo_urls: ["https://x/1.jpg", "https://x/2.jpg"],
      }),
      NEIGHBORHOODS,
    );
    expect(prefill.name).toBe("Garba chez le Vieux");
    expect(prefill.gallery_urls).toEqual(["https://x/1.jpg", "https://x/2.jpg"]);
    expect(prefill.location?.lat).toBe(5.336);
    expect(prefill.location?.lng).toBe(-4.088);
    // Commune matchée insensible casse/espaces → valeur canonique du select.
    expect(prefill.location?.neighborhood).toBe("Yopougon");
    // Le quartier précis suggéré atterrit dans l'adresse descriptive.
    expect(prefill.location?.descriptive_address).toContain("Niangon");
  });

  it("commune inconnue : pas de neighborhood forcé, reportée dans l'adresse", () => {
    const prefill = suggestionToPrefill(
      suggestion({ commune: "Grand-Bassam", description: "au bord de la plage" }),
      NEIGHBORHOODS,
    );
    expect(prefill.location?.neighborhood).toBeUndefined();
    expect(prefill.location?.descriptive_address).toBe("Grand-Bassam — au bord de la plage");
  });

  it("suggestion minimale : ni location ni photos superflues", () => {
    const prefill = suggestionToPrefill(suggestion({}), NEIGHBORHOODS);
    expect(prefill.name).toBe("Garba chez le Vieux");
    expect(prefill.location).toBeUndefined();
    expect(prefill.gallery_urls).toEqual([]);
  });
});

describe("buildRejectionPayload", () => {
  it("statut rejected + motif — reviewed_by/at laissés au trigger 0039", () => {
    const p = buildRejectionPayload("Doublon de Chez Tantie");
    expect(p).toEqual({ status: "rejected", rejection_reason: "Doublon de Chez Tantie" });
    expect(p).not.toHaveProperty("reviewed_by");
    expect(p).not.toHaveProperty("reviewed_at");
  });
});
