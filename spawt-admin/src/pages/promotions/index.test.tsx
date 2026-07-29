// Console admin 07/2026 — tests de la page Promotions avec client Supabase
// mocké : bandeau Contrat SPAWT toujours rendu + création auditée promo_*.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PromotionsList } from "./index";
import { logAuditActionBestEffort } from "../../lib/audit";

const mockDb = vi.hoisted(() => {
  const state = {
    places: [] as unknown[],
    promotions: [] as unknown[],
    inserted: [] as unknown[],
    updated: [] as { payload: unknown }[],
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
        if (ctx.table === "place_promotions") {
          if (ctx.op === "insert") {
            s.inserted.push(ctx.payload);
            return { data: { id: "new-1" }, error: null };
          }
          if (ctx.op === "update") {
            s.updated.push({ payload: ctx.payload });
            return { data: [{ id: ctx.calls.eq?.[0]?.[1] ?? "pr1" }], error: null };
          }
          if (ctx.op === "delete") return { data: null, error: null };
          return { data: s.promotions, error: null };
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

beforeEach(() => {
  mockDb.state.places = [{ id: "p1", name: "Chez Tantie", neighborhood: "Cocody", is_published: true }];
  mockDb.state.promotions = [];
  mockDb.state.inserted = [];
  mockDb.state.updated = [];
  auditMock.mockClear();
});

describe("PromotionsList — garde Contrat SPAWT", () => {
  it("affiche en permanence le bandeau « n'affecte jamais la note ni le classement »", async () => {
    render(<PromotionsList />);
    await screen.findByText("Aucune promotion pour ce filtre.");
    const banner = screen.getByRole("note", { name: "Contrat SPAWT" });
    expect(banner.textContent).toContain("affichage étiqueté");
    expect(banner.textContent).toContain("n'affecte jamais la note d'un lieu ni le classement du matching");
  });
});

describe("PromotionsList — CRUD audité", () => {
  it("crée une promotion (INSERT place_promotions) et audite promo_create", async () => {
    render(<PromotionsList />);
    await screen.findByText("Aucune promotion pour ce filtre.");

    fireEvent.change(screen.getByLabelText("Lieu"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText(/Libellé/), { target: { value: "-20% attiéké poisson" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(mockDb.state.inserted).toHaveLength(1);
    });
    expect(mockDb.state.inserted[0]).toMatchObject({
      place_id: "p1",
      label: "-20% attiéké poisson",
      is_published: false,
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "promo_create",
        entity_type: "place_promotion",
        entity_id: "new-1",
      }),
    );
  });

  it("bascule la publication et audite promo_update", async () => {
    mockDb.state.promotions = [
      {
        id: "pr1",
        place_id: "p1",
        label: "-20% attiéké",
        description: null,
        starts_at: null,
        ends_at: null,
        is_published: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        places: { name: "Chez Tantie" },
      },
    ];
    render(<PromotionsList />);
    const toggle = await screen.findByRole("button", { name: "Brouillon (publier)" });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockDb.state.updated).toHaveLength(1);
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "promo_update",
        entity_type: "place_promotion",
        entity_id: "pr1",
        payload_after: { is_published: true },
      }),
    );
  });
});
