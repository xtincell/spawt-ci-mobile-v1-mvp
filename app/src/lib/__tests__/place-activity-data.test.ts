// Événements & promotions (0049 + 0050) — data layer mode démo.
// Couvre : parité RLS des fixtures (publié + à venir/en cours pour les
// événements, publiée + fenêtre civile ouverte pour les promos), jointure
// place minimale de listUpcomingEvents, map de pastilles par lot, et les
// helpers purs (miroirs exacts des policies SQL).

import {
  listPlaceActivity,
  listPlaceEvents,
  listPlacePromotions,
  listUpcomingEvents,
} from "../data-source";
import {
  isEventCurrent,
  isEventThisWeek,
  isPromoActive,
  todayCivilDate,
} from "../place-activity";
import {
  SEED_PLACE_EVENTS,
  SEED_PLACE_PROMOTIONS,
} from "../../data/seed/place-activity";
import { SEED_PLACES } from "../../data/seed/places";

const BUSHMAN_ID = "00000000-0000-0000-0000-000000000002";
const OTHER_ID = "00000000-0000-0000-0000-000000000001"; // Bô Zinc — aucune activité

describe("listPlaceEvents — mode démo (parité RLS 0049)", () => {
  it("retourne l'événement publié à venir, filtre le passé et le brouillon", async () => {
    const events = await listPlaceEvents(BUSHMAN_ID);
    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe("Soirée braise & vinyles");
    // Ni l'événement passé publié, ni le brouillon futur.
    const titles = events.map((e) => e.title);
    expect(titles).not.toContain("Brunch des pionniers");
    expect(titles).not.toContain("Dégustation surprise (brouillon)");
  });

  it("n'expose pas la colonne is_published (contrat PlaceEvent)", async () => {
    const events = await listPlaceEvents(BUSHMAN_ID);
    expect(events[0]).not.toHaveProperty("is_published");
  });

  it("lieu sans événement → []", async () => {
    expect(await listPlaceEvents(OTHER_ID)).toEqual([]);
  });
});

describe("listPlacePromotions — mode démo (parité RLS 0050)", () => {
  it("retourne la promo active, filtre le brouillon", async () => {
    const promos = await listPlacePromotions(BUSHMAN_ID);
    expect(promos).toHaveLength(1);
    expect(promos[0]!.label).toBe("Deux jus pressés pour le prix d'un");
    expect(promos[0]).not.toHaveProperty("is_published");
  });

  it("lieu sans promo → []", async () => {
    expect(await listPlacePromotions(OTHER_ID)).toEqual([]);
  });
});

describe("listUpcomingEvents — mode démo (rangée feed)", () => {
  it("joint le nom + quartier du lieu, tri chronologique", async () => {
    const events = await listUpcomingEvents(10);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const first = events[0]!;
    expect(first.place_name).toBe("Bushman Café");
    expect(first.place_neighborhood).toBe("Cocody Riviera");
    const starts = events.map((e) => e.starts_at);
    expect(starts).toEqual([...starts].sort());
  });

  it("respecte la limite", async () => {
    const events = await listUpcomingEvents(0);
    expect(events).toEqual([]);
  });
});

describe("listPlaceActivity — pastilles par LOT (jamais un fetch par carte)", () => {
  it("mappe le lieu actif avec has_event + has_promo", async () => {
    const map = await listPlaceActivity([BUSHMAN_ID, OTHER_ID]);
    expect(map[BUSHMAN_ID]).toEqual({ has_event: true, has_promo: true });
    // Un lieu sans activité n'apparaît PAS dans la map (contrat : absent = rien).
    expect(map[OTHER_ID]).toBeUndefined();
  });

  it("liste vide → map vide sans fetch", async () => {
    expect(await listPlaceActivity([])).toEqual({});
  });
});

describe("helpers purs — miroirs exacts des policies RLS", () => {
  const now = new Date("2026-07-26T12:00:00Z");

  it("isEventCurrent : coalesce(ends_at, starts_at) >= now", () => {
    // En cours : commencé mais pas fini.
    expect(
      isEventCurrent(
        { starts_at: "2026-07-26T10:00:00Z", ends_at: "2026-07-26T14:00:00Z" },
        now,
      ),
    ).toBe(true);
    // Passé (fin avant now).
    expect(
      isEventCurrent(
        { starts_at: "2026-07-25T10:00:00Z", ends_at: "2026-07-25T14:00:00Z" },
        now,
      ),
    ).toBe(false);
    // Sans ends_at : le start fait foi (passé → filtré).
    expect(
      isEventCurrent({ starts_at: "2026-07-25T10:00:00Z", ends_at: null }, now),
    ).toBe(false);
    expect(
      isEventCurrent({ starts_at: "2026-07-27T10:00:00Z", ends_at: null }, now),
    ).toBe(true);
    // Timestamp illisible → false (rien d'affiché sans date fiable).
    expect(isEventCurrent({ starts_at: "n'importe", ends_at: null }, now)).toBe(false);
  });

  it("isEventThisWeek : d'actualité ET démarre sous 7 jours", () => {
    expect(
      isEventThisWeek({ starts_at: "2026-07-28T19:00:00Z", ends_at: null }, now),
    ).toBe(true);
    // Trop loin (J+10) : hors rangée « cette semaine ».
    expect(
      isEventThisWeek({ starts_at: "2026-08-05T19:00:00Z", ends_at: null }, now),
    ).toBe(false);
  });

  it("isPromoActive : fenêtre civile ouverte, borne absente = pas de contrainte", () => {
    const today = "2026-07-26";
    expect(isPromoActive({ starts_at: "2026-07-20", ends_at: "2026-07-30" }, today)).toBe(true);
    expect(isPromoActive({ starts_at: "2026-07-26", ends_at: "2026-07-26" }, today)).toBe(true); // bornes inclusives
    expect(isPromoActive({ starts_at: "2026-07-27", ends_at: null }, today)).toBe(false); // pas commencée
    expect(isPromoActive({ starts_at: null, ends_at: "2026-07-25" }, today)).toBe(false); // finie
    expect(isPromoActive({ starts_at: null, ends_at: null }, today)).toBe(true); // sans borne
  });

  it("todayCivilDate : format YYYY-MM-DD", () => {
    expect(todayCivilDate(new Date(2026, 6, 5))).toBe("2026-07-05");
  });
});

describe("fixtures — parité contraintes DB + alignement seed", () => {
  it("chaque fixture référence un lieu existant du seed", () => {
    for (const e of SEED_PLACE_EVENTS) {
      expect(SEED_PLACES.some((p) => p.id === e.place_id)).toBe(true);
    }
    for (const p of SEED_PLACE_PROMOTIONS) {
      expect(SEED_PLACES.some((pl) => pl.id === p.place_id)).toBe(true);
    }
  });

  it("CHECK 0049 : title non vide, ends_at >= starts_at", () => {
    for (const e of SEED_PLACE_EVENTS) {
      expect(e.title.trim().length).toBeGreaterThan(0);
      if (e.ends_at !== null) {
        expect(e.ends_at >= e.starts_at).toBe(true);
      }
    }
  });

  it("CHECK 0050 : label non vide, fenêtre cohérente (dates civiles)", () => {
    for (const p of SEED_PLACE_PROMOTIONS) {
      expect(p.label.trim().length).toBeGreaterThan(0);
      if (p.starts_at !== null && p.ends_at !== null) {
        expect(p.ends_at >= p.starts_at).toBe(true);
      }
      // Format date civile YYYY-MM-DD (colonnes `date`, pas timestamptz).
      for (const d of [p.starts_at, p.ends_at]) {
        if (d !== null) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("fixtures VIVANTES : la démo a toujours 1 événement à venir + 1 promo active", async () => {
    // Le cœur de la doctrine « fixtures vivantes » : quel que soit le jour
    // d'exécution, la preview montre l'activité de Bushman Café.
    expect((await listPlaceEvents(BUSHMAN_ID)).length).toBeGreaterThanOrEqual(1);
    expect((await listPlacePromotions(BUSHMAN_ID)).length).toBeGreaterThanOrEqual(1);
  });
});
