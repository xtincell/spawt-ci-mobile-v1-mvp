// Console admin 07/2026 — tests logique pure page Événements (0049).

import { describe, it, expect } from "vitest";
import {
  EMPTY_EVENT_FORM,
  eventRowToForm,
  filterEvents,
  fromDatetimeLocal,
  isUpcoming,
  toDatetimeLocal,
  validateEventForm,
  type PlaceEventRow,
} from "./logic";

const NOW = new Date("2026-07-26T12:00:00Z");

function row(partial: Partial<PlaceEventRow>): PlaceEventRow {
  return {
    id: "e1",
    place_id: "p1",
    title: "Soirée braisé",
    description: null,
    starts_at: "2026-08-01T19:00:00Z",
    ends_at: null,
    image_url: null,
    is_published: false,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...partial,
  };
}

describe("isUpcoming", () => {
  it("à venir : starts_at futur sans fin", () => {
    expect(isUpcoming(row({ starts_at: "2026-08-01T19:00:00Z" }), NOW)).toBe(true);
  });

  it("en cours : commencé mais ends_at futur (aligné policy RLS 0049)", () => {
    expect(
      isUpcoming(row({ starts_at: "2026-07-26T10:00:00Z", ends_at: "2026-07-26T14:00:00Z" }), NOW),
    ).toBe(true);
  });

  it("passé : starts_at révolu sans fin déclarée", () => {
    expect(isUpcoming(row({ starts_at: "2026-07-25T19:00:00Z" }), NOW)).toBe(false);
  });

  it("passé : ends_at révolu", () => {
    expect(
      isUpcoming(row({ starts_at: "2026-07-20T19:00:00Z", ends_at: "2026-07-21T02:00:00Z" }), NOW),
    ).toBe(false);
  });
});

describe("filterEvents", () => {
  const rows = [
    row({ id: "a", place_id: "p1", starts_at: "2026-08-01T19:00:00Z" }),
    row({ id: "b", place_id: "p2", starts_at: "2026-08-02T19:00:00Z" }),
    row({ id: "c", place_id: "p1", starts_at: "2026-07-01T19:00:00Z" }),
  ];

  it("filtre par lieu ET par temporalité", () => {
    expect(filterEvents(rows, "p1", "upcoming", NOW).map((r) => r.id)).toEqual(["a"]);
    expect(filterEvents(rows, "p1", "past", NOW).map((r) => r.id)).toEqual(["c"]);
    expect(filterEvents(rows, "all", "all", NOW)).toHaveLength(3);
  });
});

describe("conversions datetime-local", () => {
  it("round-trip ISO → local → ISO (à la minute près)", () => {
    const iso = new Date("2026-08-01T19:30:00Z").toISOString();
    const local = toDatetimeLocal(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDatetimeLocal(local)).toBe(iso);
  });

  it("valeur vide / invalide → null", () => {
    expect(fromDatetimeLocal("")).toBeNull();
    expect(fromDatetimeLocal("n'importe quoi")).toBeNull();
  });
});

describe("validateEventForm", () => {
  const valid = {
    ...EMPTY_EVENT_FORM,
    place_id: "p1",
    title: "Soirée braisé",
    starts_at: "2026-08-01T19:00",
  };

  it("accepte un formulaire minimal valide et trim les champs", () => {
    const res = validateEventForm({ ...valid, title: "  Soirée braisé  ", description: "  " });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.title).toBe("Soirée braisé");
      expect(res.row.description).toBeNull();
      expect(res.row.ends_at).toBeNull();
    }
  });

  it("refuse lieu manquant, titre vide, début manquant", () => {
    const res = validateEventForm({ ...EMPTY_EVENT_FORM, title: "   " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toHaveLength(3);
  });

  it("refuse une fin avant le début (miroir CHECK 0049)", () => {
    const res = validateEventForm({ ...valid, ends_at: "2026-08-01T18:00" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toMatch(/fin/i);
  });

  it("refuse une URL d'image non http(s)", () => {
    const res = validateEventForm({ ...valid, image_url: "ftp://x" });
    expect(res.ok).toBe(false);
  });
});

describe("eventRowToForm", () => {
  it("re-pivote la row DB vers le formulaire (round-trip datetime)", () => {
    const r = row({ ends_at: "2026-08-02T01:00:00Z", description: "gros son", image_url: "https://x/y.jpg" });
    const form = eventRowToForm(r);
    expect(form.place_id).toBe("p1");
    expect(form.description).toBe("gros son");
    expect(fromDatetimeLocal(form.starts_at)).toBe(new Date(r.starts_at).toISOString());
    expect(fromDatetimeLocal(form.ends_at)).toBe(new Date(r.ends_at as string).toISOString());
  });
});
