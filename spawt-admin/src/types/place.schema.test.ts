import { describe, it, expect } from "vitest";
import { PlaceFormSchema } from "./place.schema";

describe("PlaceFormSchema — Story 6.2", () => {
  const base = {
    name: "Bô Zinc",
    cuisine: ["francaise"],
    location: {
      lat: 5.328,
      lng: -4.009,
      descriptive_address: "Zone 4",
      neighborhood: "Zone 4",
      city: "Abidjan",
    },
    price: { tier: 2 as const, avg_ticket_xof: 12000 },
    hours: {},
    is_published: true,
    gallery_urls: [],
    signals: [],
  };

  it("accepte une valeur valide minimale", () => {
    const r = PlaceFormSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("rejette name vide", () => {
    const r = PlaceFormSchema.safeParse({ ...base, name: "" });
    expect(r.success).toBe(false);
  });

  it("rejette cuisine vide", () => {
    const r = PlaceFormSchema.safeParse({ ...base, cuisine: [] });
    expect(r.success).toBe(false);
  });

  it("rejette lat hors range", () => {
    const r = PlaceFormSchema.safeParse({ ...base, location: { ...base.location, lat: 100 } });
    expect(r.success).toBe(false);
  });

  it("rejette phone non-E.164", () => {
    const r = PlaceFormSchema.safeParse({ ...base, phone: "0102030405" });
    expect(r.success).toBe(false);
  });

  // menu_urls — même sémantique que gallery_urls (places.menu_urls TEXT[] DEFAULT '{}').
  it("menu_urls absent → défaut []", () => {
    const r = PlaceFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.menu_urls).toEqual([]);
  });

  it("accepte menu_urls avec URLs valides", () => {
    const r = PlaceFormSchema.safeParse({
      ...base,
      menu_urls: ["https://cdn.spawt.example/menus/page-1.jpg", "https://cdn.spawt.example/menus/page-2.jpg"],
    });
    expect(r.success).toBe(true);
  });

  it("rejette menu_urls avec une entrée non-URL", () => {
    const r = PlaceFormSchema.safeParse({ ...base, menu_urls: ["pas-une-url"] });
    expect(r.success).toBe(false);
  });
});
