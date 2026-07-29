// CR Chunk B m13 — Tests Zod bornes Abidjan + heures 24h strictes.

import { describe, expect, it } from "vitest";
import { OpeningSlotSchema, PlaceFormSchema } from "./place.schema";

describe("PlaceLocationSchema — bornes Abidjan (CR m13)", () => {
  const baseForm = {
    name: "Test",
    cuisine: ["ivoirienne"],
    location: {
      lat: 5.35,
      lng: -3.97,
      descriptive_address: "Test",
      neighborhood: "Cocody",
      city: "Abidjan",
    },
    price: { tier: 2 as const, avg_ticket_xof: null },
    hours: {},
    is_published: false,
  };

  it("accepte un lieu à Cocody (lat 5.35, lng -3.97)", () => {
    expect(PlaceFormSchema.safeParse(baseForm).success).toBe(true);
  });

  it("rejette un lieu à Hanoi (lat 21, lng 105)", () => {
    const out = PlaceFormSchema.safeParse({
      ...baseForm,
      location: { ...baseForm.location, lat: 21.0285, lng: 105.8542 },
    });
    expect(out.success).toBe(false);
  });

  it("rejette une latitude au sud d'Abidjan (lat 5.0)", () => {
    const out = PlaceFormSchema.safeParse({
      ...baseForm,
      location: { ...baseForm.location, lat: 5.0 },
    });
    expect(out.success).toBe(false);
  });

  it("rejette une longitude à l'est d'Abidjan (lng -3.5)", () => {
    const out = PlaceFormSchema.safeParse({
      ...baseForm,
      location: { ...baseForm.location, lng: -3.5 },
    });
    expect(out.success).toBe(false);
  });

  it("accepte les bornes basses Bingerville (lat 5.20, lng -4.30)", () => {
    expect(
      PlaceFormSchema.safeParse({
        ...baseForm,
        location: { ...baseForm.location, lat: 5.20, lng: -4.30 },
      }).success,
    ).toBe(true);
  });
});

describe("OpeningSlotSchema — strict 24h (CR m13)", () => {
  it("accepte 00:00 et 23:59", () => {
    expect(OpeningSlotSchema.safeParse({ open: "00:00", close: "23:59" }).success).toBe(true);
  });

  it("rejette 24:00 (hors range)", () => {
    expect(OpeningSlotSchema.safeParse({ open: "24:00", close: "12:00" }).success).toBe(false);
  });

  it("rejette 29:59 (ancien regex faux ami)", () => {
    expect(OpeningSlotSchema.safeParse({ open: "29:59", close: "12:00" }).success).toBe(false);
  });

  it("rejette format sans :", () => {
    expect(OpeningSlotSchema.safeParse({ open: "1200", close: "12:00" }).success).toBe(false);
  });

  it("rejette minute > 59", () => {
    expect(OpeningSlotSchema.safeParse({ open: "12:60", close: "12:00" }).success).toBe(false);
  });
});
