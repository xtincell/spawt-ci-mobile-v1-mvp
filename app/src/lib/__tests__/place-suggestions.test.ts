// Feature 18 — tests du moteur démo de suggestion de lieu (AsyncStorage) :
// soumission, quota 5 pending (miroir du trigger DB 0039), tri fraîcheur,
// robustesse au stockage corrompu.

import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  listDemoPlaceSuggestions,
  MAX_PENDING_SUGGESTIONS,
  submitDemoPlaceSuggestion,
  type PlaceSuggestionInput,
} from "../place-suggestions";

const STORAGE_KEY = "spawt:place-suggestions";

function input(overrides: Partial<PlaceSuggestionInput> = {}): PlaceSuggestionInput {
  return {
    name: "Chez Tantie Marie",
    commune: "Cocody",
    neighborhood: "en face de la pharmacie",
    description: null,
    lat: null,
    lng: null,
    photo_urls: [],
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("submitDemoPlaceSuggestion", () => {
  it("enregistre la suggestion en pending et la restitue", async () => {
    const result = await submitDemoPlaceSuggestion(input());
    expect(result).toBe("ok");
    const rows = await listDemoPlaceSuggestions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Chez Tantie Marie",
      commune: "Cocody",
      status: "pending",
      rejection_reason: null,
    });
    expect(rows[0]?.id.length).toBeGreaterThan(0);
  });

  it("applique le quota : la 6e suggestion pending est refusée", async () => {
    for (let i = 0; i < MAX_PENDING_SUGGESTIONS; i++) {
      expect(await submitDemoPlaceSuggestion(input({ name: `Spot ${i}` }))).toBe("ok");
    }
    expect(await submitDemoPlaceSuggestion(input({ name: "Spot de trop" }))).toBe(
      "quota_exceeded",
    );
    expect(await listDemoPlaceSuggestions()).toHaveLength(MAX_PENDING_SUGGESTIONS);
  });

  it("les suggestions traitées ne comptent pas dans le quota (pending only)", async () => {
    const processed = Array.from({ length: 5 }, (_, i) => ({
      ...input({ name: `Validé ${i}` }),
      id: `row-${i}`,
      status: "approved",
      rejection_reason: null,
      created_at: `2026-07-0${i + 1}T00:00:00Z`,
    }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(processed));
    expect(await submitDemoPlaceSuggestion(input())).toBe("ok");
  });
});

describe("listDemoPlaceSuggestions", () => {
  it("tri par fraîcheur (plus récentes d'abord)", async () => {
    const rows = [
      { ...input({ name: "Ancien" }), id: "a", status: "pending", rejection_reason: null, created_at: "2026-05-01T00:00:00Z" },
      { ...input({ name: "Récent" }), id: "b", status: "pending", rejection_reason: null, created_at: "2026-07-01T00:00:00Z" },
    ];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    const list = await listDemoPlaceSuggestions();
    expect(list.map((r) => r.name)).toEqual(["Récent", "Ancien"]);
  });

  it("stockage corrompu → liste vide, aucun crash", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "{pas du json[");
    expect(await listDemoPlaceSuggestions()).toEqual([]);
    // Et une soumission derrière repart proprement.
    expect(await submitDemoPlaceSuggestion(input())).toBe("ok");
  });
});
