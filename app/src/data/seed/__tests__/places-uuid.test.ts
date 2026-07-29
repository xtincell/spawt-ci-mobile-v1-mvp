// Story 3.3a — cohérence client/serveur sur les UUIDs SEED_PLACES.
// Vérifie que tous les seeds TS utilisent les 12 UUIDs séquentiels stables 1-12
// qui matchent supabase/seed/places.sql.

import { SEED_PLACES } from "../places";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("SEED_PLACES — cohérence UUID client/serveur", () => {
  it("contient 12 entrées (les 12 lieux Sprint 1)", () => {
    expect(SEED_PLACES).toHaveLength(12);
  });

  it("chaque id est un UUID v4 valide", () => {
    for (const seed of SEED_PLACES) {
      expect(seed.id).toMatch(UUID_RE);
    }
  });

  it("chaque adn.place_id matche l'id du seed parent", () => {
    for (const seed of SEED_PLACES) {
      expect(seed.adn.place_id).toBe(seed.id);
    }
  });

  it("utilise les UUIDs séquentiels 1-12 attendus par le seed SQL", () => {
    const expected = [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
      "00000000-0000-0000-0000-000000000004",
      "00000000-0000-0000-0000-000000000005",
      "00000000-0000-0000-0000-000000000006",
      "00000000-0000-0000-0000-000000000007",
      "00000000-0000-0000-0000-000000000008",
      "00000000-0000-0000-0000-000000000009",
      "00000000-0000-0000-0000-000000000010",
      "00000000-0000-0000-0000-000000000011",
      "00000000-0000-0000-0000-000000000012",
    ];
    expect(SEED_PLACES.map((s) => s.id)).toEqual(expected);
  });

  it("pas d'id en slug legacy (place_*)", () => {
    for (const seed of SEED_PLACES) {
      expect(seed.id).not.toMatch(/^place_/);
    }
  });
});
