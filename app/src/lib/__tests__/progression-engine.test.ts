// Progression — tests du moteur d'agrégation pur (progression-engine.ts).
// Métriques client, fusion catalogue × état, groupements, prochains badges,
// % de défi collectif, agrégateur unique.

import {
  buildBadgeStates,
  buildProgressionSummary,
  challengePercent,
  computeClientBadgeMetrics,
  displayedBadges,
  groupBadgesByCategory,
  groupCardsByRarity,
  nextBadges,
} from "../progression-engine";
import type {
  ActiveChallenge,
  BadgeCatalogueEntry,
  BadgeSnapshot,
  OwnedCard,
} from "../../types/progression";
import type { SpawtCheckin } from "../../types/spawt";

function spawt(overrides: Partial<SpawtCheckin> = {}): SpawtCheckin {
  return {
    id: `spawt-${Math.random().toString(36).slice(2, 8)}`,
    spawter_id: "spawter-1",
    place_id: "place-1",
    arrived_at: "2026-07-10T12:00:00Z",
    notified_at: null,
    snoozed_at: null,
    snooze_count: 0,
    checked_in_at: "2026-07-10T12:05:00Z",
    left_at: null,
    check_in_type: "active",
    session_duration_minutes: null,
    geolocation_lat: null,
    geolocation_lng: null,
    accuracy_meters: null,
    geolocation_source: "gps",
    distance_to_lieu_meters: null,
    is_verified: true,
    flag_reason: null,
    note_etoiles: null,
    texte_avis: null,
    tags: [],
    photos: [],
    is_cancelled: false,
    is_seed: false,
    created_at: "2026-07-10T12:00:00Z",
    updated_at: "2026-07-10T12:00:00Z",
    ...overrides,
  };
}

function entry(
  code: string,
  overrides: Partial<BadgeCatalogueEntry> = {},
): BadgeCatalogueEntry {
  return {
    code,
    category: "exploration",
    title_key: `badge.${code}.title`,
    description_key: `badge.${code}.description`,
    condition_type: "spawts_total",
    threshold: 10,
    sort_order: 1,
    ...overrides,
  };
}

function card(code: string, overrides: Partial<OwnedCard> = {}): OwnedCard {
  return {
    id: `card-${code}`,
    code,
    kind: "archetype",
    rarity: "commun",
    title: code,
    image_url: null,
    verso_text: null,
    obtained_at: "2026-07-01T00:00:00Z",
    source: "admin",
    ...overrides,
  };
}

describe("computeClientBadgeMetrics", () => {
  it("compte les spawts vérifiés hors seed/annulés (mêmes exclusions que le SQL)", () => {
    const metrics = computeClientBadgeMetrics([
      spawt(),
      spawt({ is_verified: false }),
      spawt({ is_seed: true }),
      spawt({ is_cancelled: true }),
    ]);
    expect(metrics.spawts_total).toBe(1);
    expect(metrics.premier_spawt).toBe(1);
  });

  it("compte les spawts après 21h UTC et le weekend", () => {
    const metrics = computeClientBadgeMetrics([
      // Vendredi 2026-07-10, 22h UTC → après 21h mais pas weekend.
      spawt({ arrived_at: "2026-07-10T22:30:00Z" }),
      // Samedi 2026-07-11, midi → weekend.
      spawt({ arrived_at: "2026-07-11T12:00:00Z" }),
      // Dimanche 2026-07-12, 21h05 → weekend ET après 21h.
      spawt({ arrived_at: "2026-07-12T21:05:00Z" }),
    ]);
    expect(metrics.spawts_apres_21h).toBe(2);
    expect(metrics.spawts_weekend).toBe(2);
  });

  it("compte les avis (note non-null) et les photos des avis", () => {
    const metrics = computeClientBadgeMetrics([
      spawt({ note_etoiles: 4, photos: ["a.jpg", "b.jpg"] }),
      spawt({ note_etoiles: 5, photos: [] }),
      // Note sur un spawt seed → exclu des deux compteurs.
      spawt({ note_etoiles: 3, is_seed: true, photos: ["c.jpg"] }),
      // Pas de note → pas un avis, photos non comptées.
      spawt({ photos: ["d.jpg"] }),
    ]);
    expect(metrics.avis_total).toBe(2);
    expect(metrics.photos_publiees).toBe(2);
  });

  it("date invalide → ignorée sans crash", () => {
    const metrics = computeClientBadgeMetrics([spawt({ arrived_at: "n'importe quoi" })]);
    expect(metrics.spawts_apres_21h).toBe(0);
    expect(metrics.spawts_total).toBe(1);
  });
});

describe("buildBadgeStates", () => {
  const snapshot: BadgeSnapshot = {
    catalogue: [
      entry("b", { sort_order: 2 }),
      entry("a", { sort_order: 1 }),
      entry("c", { sort_order: 3, condition_type: "parrainages", threshold: 3 }),
    ],
    unlocked: [
      { badge_code: "a", unlocked_at: "2026-07-01T00:00:00Z", is_displayed: true },
    ],
  };

  it("trie par sort_order et fusionne l'état du spawter", () => {
    const badges = buildBadgeStates(snapshot, { spawts_total: 5 });
    expect(badges.map((b) => b.code)).toEqual(["a", "b", "c"]);
    expect(badges[0]).toMatchObject({
      unlocked: true,
      is_displayed: true,
      progress_percent: 1,
    });
  });

  it("% calculable → current/threshold clampé ; débloqué → 1", () => {
    const badges = buildBadgeStates(snapshot, { spawts_total: 5 });
    const b = badges.find((x) => x.code === "b");
    expect(b?.progress_current).toBe(5);
    expect(b?.progress_percent).toBe(0.5);
  });

  it("métrique non dérivable localement → AUCUN % inventé (null)", () => {
    const badges = buildBadgeStates(snapshot, { spawts_total: 5 });
    const c = badges.find((x) => x.code === "c");
    expect(c?.progress_current).toBeNull();
    expect(c?.progress_percent).toBeNull();
  });
});

describe("groupBadgesByCategory / displayedBadges / nextBadges", () => {
  const badges = buildBadgeStates(
    {
      catalogue: [
        entry("core1", { category: "core", sort_order: 1, condition_type: "premier_spawt", threshold: 1 }),
        entry("exp1", { category: "exploration", sort_order: 10 }),
        entry("inf1", { category: "influence", sort_order: 50, condition_type: "parrainages" }),
        entry("custom1", { category: "influence", sort_order: 51, condition_type: "custom", threshold: null }),
      ],
      unlocked: [
        { badge_code: "core1", unlocked_at: "2026-07-01T00:00:00Z", is_displayed: true },
      ],
    },
    { premier_spawt: 1, spawts_total: 7 },
  );

  it("groupe dans l'ordre canonique, catégories vides omises", () => {
    const groups = groupBadgesByCategory(badges);
    expect(groups.map((g) => g.category)).toEqual(["core", "exploration", "influence"]);
  });

  it("displayedBadges = débloqués ET affichés, cap 3", () => {
    expect(displayedBadges(badges).map((b) => b.code)).toEqual(["core1"]);
  });

  it("nextBadges : verrouillés hors custom, % décroissant puis sans-% par seuil", () => {
    const next = nextBadges(badges);
    expect(next.map((b) => b.code)).toEqual(["exp1", "inf1"]);
    expect(next.find((b) => b.code === "custom1")).toBeUndefined();
  });
});

describe("groupCardsByRarity", () => {
  it("groupe légendaire d'abord, tri fraîcheur intra-groupe, vides omis", () => {
    const groups = groupCardsByRarity([
      card("c1", { rarity: "commun", obtained_at: "2026-05-01T00:00:00Z" }),
      card("l1", { rarity: "legendaire" }),
      card("c2", { rarity: "commun", obtained_at: "2026-06-01T00:00:00Z" }),
    ]);
    expect(groups.map((g) => g.rarity)).toEqual(["legendaire", "commun"]);
    expect(groups[1]?.cards.map((c) => c.code)).toEqual(["c2", "c1"]);
  });
});

describe("challengePercent", () => {
  const base: ActiveChallenge = {
    id: "d1",
    code: "defi",
    title_key: "defi.defi.title",
    description_key: "defi.defi.description",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    goal_type: "spawts_total",
    goal_target: 1000,
    reward_paws: 50,
    current_value: 620,
  };

  it("62 % pour 620/1000, clampé [0,1]", () => {
    expect(challengePercent(base)).toBe(0.62);
    expect(challengePercent({ ...base, current_value: 2000 })).toBe(1);
    expect(challengePercent({ ...base, current_value: -5 })).toBe(0);
  });

  it("objectif nul ou négatif → 0 (jamais de division par zéro)", () => {
    expect(challengePercent({ ...base, goal_target: 0 })).toBe(0);
  });
});

describe("buildProgressionSummary", () => {
  it("agrège stade, badges, cartes, paws, streak et défis en un snapshot UI", () => {
    const summary = buildProgressionSummary({
      spawter: { stade: "explorateur", unique_spots: 7 },
      spawts: [spawt(), spawt({ place_id: "place-2" })],
      badges: {
        catalogue: [entry("a", { threshold: 10 })],
        unlocked: [],
      },
      cards: [card("c1")],
      pawsBalance: 120,
      pawsLedger: [],
      streak: { current_weeks: 3, best_weeks: 5, last_spawt_week: "2026-07-20" },
      challenges: [],
    });
    expect(summary.stade.current_stade).toBe("explorateur");
    expect(summary.badges).toHaveLength(1);
    expect(summary.badges[0]?.progress_current).toBe(2);
    expect(summary.unlockedCount).toBe(0);
    expect(summary.cardsCount).toBe(1);
    expect(summary.pawsBalance).toBe(120);
    expect(summary.streak?.current_weeks).toBe(3);
  });
});
