// Console admin 07/2026 — tests de la page Événements avec client Supabase
// mocké (pattern mock dataProvider) : CRUD réel + audit event_* appelé.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EvenementsList } from "./index";
import { logAuditActionBestEffort } from "../../lib/audit";

const mockDb = vi.hoisted(() => {
  const state = {
    places: [] as unknown[],
    events: [] as unknown[],
    inserted: [] as unknown[],
    updated: [] as { payload: unknown }[],
    deletedIds: [] as unknown[],
  };
  return { state };
});

vi.mock("../../utility/supabaseClient", async () => {
  const { createFromMock } = await import("../../test/supabaseMock");
  return {
    supabaseClient: {
      from: createFromMock((ctx) => {
        const s = mockDb.state;
        if (ctx.table === "places") return { data: s.places, error: null };
        if (ctx.table === "place_events") {
          if (ctx.op === "insert") {
            s.inserted.push(ctx.payload);
            return { data: { id: "new-1" }, error: null };
          }
          if (ctx.op === "update") {
            s.updated.push({ payload: ctx.payload });
            return { data: [{ id: ctx.calls.eq?.[0]?.[1] ?? "e1" }], error: null };
          }
          if (ctx.op === "delete") {
            s.deletedIds.push(ctx.calls.eq?.[0]?.[1]);
            return { data: null, error: null };
          }
          return { data: s.events, error: null };
        }
        return { data: [], error: null };
      }),
    },
  };
});

vi.mock("../../lib/audit", () => ({
  logAuditActionBestEffort: vi.fn().mockResolvedValue(true),
}));

const auditMock = vi.mocked(logAuditActionBestEffort);

const PLACE = { id: "p1", name: "Chez Tantie", neighborhood: "Cocody", is_published: true };

function futureEvent(partial: Record<string, unknown> = {}) {
  return {
    id: "e1",
    place_id: "p1",
    title: "Soirée braisé",
    description: null,
    starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    ends_at: null,
    image_url: null,
    is_published: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    places: { name: "Chez Tantie" },
    ...partial,
  };
}

beforeEach(() => {
  mockDb.state.places = [PLACE];
  mockDb.state.events = [];
  mockDb.state.inserted = [];
  mockDb.state.updated = [];
  mockDb.state.deletedIds = [];
  auditMock.mockClear();
});

describe("EvenementsList — création", () => {
  it("crée un événement (INSERT place_events) et audite event_create", async () => {
    render(<EvenementsList />);
    await screen.findByText("Aucun événement pour ce filtre.");

    fireEvent.change(screen.getByLabelText("Lieu"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Soirée braisé" } });
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "2026-08-01T19:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(mockDb.state.inserted).toHaveLength(1);
    });
    expect(mockDb.state.inserted[0]).toMatchObject({
      place_id: "p1",
      title: "Soirée braisé",
      is_published: false,
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "event_create",
        entity_type: "place_event",
        entity_id: "new-1",
      }),
    );
  });

  it("bloque un formulaire invalide sans INSERT ni audit", async () => {
    render(<EvenementsList />);
    await screen.findByText("Aucun événement pour ce filtre.");

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await screen.findByText(/Le titre est obligatoire/);
    expect(mockDb.state.inserted).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });
});

describe("EvenementsList — publication & suppression", () => {
  it("bascule la publication (UPDATE is_published) et audite event_update", async () => {
    mockDb.state.events = [futureEvent()];
    render(<EvenementsList />);
    const toggle = await screen.findByRole("button", { name: "Brouillon (publier)" });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockDb.state.updated).toHaveLength(1);
    });
    expect(mockDb.state.updated[0].payload).toEqual({ is_published: true });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "event_update",
        entity_type: "place_event",
        entity_id: "e1",
        payload_after: { is_published: true },
      }),
    );
  });

  it("supprime après confirmation et audite event_delete", async () => {
    mockDb.state.events = [futureEvent()];
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<EvenementsList />);
    const del = await screen.findByRole("button", { name: "Supprimer" });
    fireEvent.click(del);

    await waitFor(() => {
      expect(mockDb.state.deletedIds).toEqual(["e1"]);
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "event_delete", entity_type: "place_event" }),
    );
    confirmSpy.mockRestore();
  });
});
