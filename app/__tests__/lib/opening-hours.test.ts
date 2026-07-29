// R20 — tests de la logique « ouvert maintenant » (créneaux simples,
// nocturnes passant minuit, données dégradées) + partition open-first stable.

import { isOpenAt, partitionOpenFirst } from "../../src/lib/opening-hours";
import type { DayOfWeek, OpeningSlot } from "../../src/types/place";

type Hours = Partial<Record<DayOfWeek, OpeningSlot[]>>;

// Mercredi 2026-07-08, heure locale contrôlée via le constructeur local.
function wednesdayAt(h: number, m: number): Date {
  return new Date(2026, 6, 8, h, m, 0, 0); // juillet = index 6 ; 8/7/2026 = mercredi
}

const CLASSIC: Hours = {
  wed: [
    { open: "11:30", close: "15:00" },
    { open: "19:00", close: "23:00" },
  ],
};

describe("isOpenAt — créneaux simples", () => {
  it("ouvert pendant le service de midi", () => {
    expect(isOpenAt(CLASSIC, wednesdayAt(12, 30))).toBe(true);
  });

  it("fermé entre deux services", () => {
    expect(isOpenAt(CLASSIC, wednesdayAt(16, 0))).toBe(false);
  });

  it("borne : ouvert à l'heure d'ouverture pile, fermé à la fermeture pile", () => {
    expect(isOpenAt(CLASSIC, wednesdayAt(11, 30))).toBe(true);
    expect(isOpenAt(CLASSIC, wednesdayAt(15, 0))).toBe(false);
  });

  it("fermé un jour sans créneau", () => {
    expect(isOpenAt({ thu: [{ open: "09:00", close: "18:00" }] }, wednesdayAt(12, 0))).toBe(false);
  });
});

describe("isOpenAt — créneaux nocturnes (passent minuit)", () => {
  const NIGHT: Hours = {
    tue: [{ open: "19:00", close: "02:00" }],
    wed: [{ open: "19:00", close: "02:00" }],
  };

  it("ouvert en soirée (côté jour même)", () => {
    expect(isOpenAt(NIGHT, wednesdayAt(23, 30))).toBe(true);
  });

  it("ouvert après minuit via le créneau de la VEILLE (mardi 19:00–02:00)", () => {
    expect(isOpenAt(NIGHT, wednesdayAt(1, 0))).toBe(true);
  });

  it("fermé après la queue nocturne", () => {
    expect(isOpenAt(NIGHT, wednesdayAt(3, 0))).toBe(false);
  });
});

describe("isOpenAt — données dégradées (fail-closed)", () => {
  it("hours null/undefined → fermé", () => {
    expect(isOpenAt(null, wednesdayAt(12, 0))).toBe(false);
    expect(isOpenAt(undefined, wednesdayAt(12, 0))).toBe(false);
  });

  it("créneau malformé ou de durée nulle → ignoré", () => {
    expect(isOpenAt({ wed: [{ open: "25:00", close: "26:00" }] }, wednesdayAt(12, 0))).toBe(false);
    expect(isOpenAt({ wed: [{ open: "12:00", close: "12:00" }] }, wednesdayAt(12, 0))).toBe(false);
  });
});

describe("partitionOpenFirst", () => {
  interface Item {
    id: string;
    hours: Hours;
  }
  const open: Hours = { wed: [{ open: "08:00", close: "22:00" }] };
  const closed: Hours = {};

  it("remonte les ouverts en tête en préservant l'ordre relatif (tri stable)", () => {
    const items: Item[] = [
      { id: "a-ferme", hours: closed },
      { id: "b-ouvert", hours: open },
      { id: "c-ferme", hours: closed },
      { id: "d-ouvert", hours: open },
    ];
    const out = partitionOpenFirst(items, (i) => i.hours, wednesdayAt(12, 0));
    expect(out.map((i) => i.id)).toEqual(["b-ouvert", "d-ouvert", "a-ferme", "c-ferme"]);
  });

  it("liste vide → liste vide, sans muter l'entrée", () => {
    const items: Item[] = [{ id: "x", hours: closed }];
    const out = partitionOpenFirst(items, (i) => i.hours, wednesdayAt(12, 0));
    expect(out).not.toBe(items);
    expect(partitionOpenFirst([], () => closed, wednesdayAt(12, 0))).toEqual([]);
  });
});
