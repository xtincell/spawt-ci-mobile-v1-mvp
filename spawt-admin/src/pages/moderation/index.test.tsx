import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Refine, type DataProvider } from "@refinedev/core";
import { MemoryRouter } from "react-router";
import { ModerationList } from "./index";

vi.mock("../../lib/audit", () => ({ logAuditAction: vi.fn(), logAuditActionBestEffort: vi.fn(), AuditLogError: Error }));
vi.mock("../../lib/moderate-spawter", () => ({ moderateSpawter: vi.fn() }));
afterEach(cleanup);

it("conserve les filtres de modération à travers Refine : avis notés, non supprimés et signalés", async () => {
  const getList = vi.fn().mockResolvedValue({ data: [], total: 0 });
  const provider: DataProvider = { getList, getOne: vi.fn(), create: vi.fn(), update: vi.fn(), deleteOne: vi.fn(), getApiUrl: () => "https://api.example.test" };
  render(<MemoryRouter><Refine dataProvider={provider}><ModerationList /></Refine></MemoryRouter>);
  await waitFor(() => expect(getList).toHaveBeenCalled());
  expect(getList.mock.lastCall?.[0].filters).toEqual([
    { field: "note_etoiles", operator: "nnull", value: "null" },
    { field: "deleted_at", operator: "null", value: "null" },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Flagged anti-fraude" }));
  await waitFor(() => expect(getList.mock.lastCall?.[0].filters).toContainEqual({ field: "flag_reason", operator: "nnull", value: "null" }));
});

it("affiche l'auteur public et les trois critères en conservant le propriétaire technique", async () => {
 const getList = vi.fn().mockResolvedValue({ data: [{ id: "review", spawter_id: "seed-owner", created_at: "2026-10-09T12:00:00Z", is_seed: true, note_etoiles: 4, note_cuisine: 5, note_cadre: 4, note_service: 4, tags: [],
  spawters: { id: "seed-owner", display_name: "Mission 1", stade: "guide" },
  review_author_attributions: { spawter_id: "alex", spawters: { id: "alex", display_name: "Alexandre", stade: "touriste" } }, places: { name: "La Grande République", neighborhood: "Cocody" } }], total: 1 });
 const provider: DataProvider = { getList, getOne: vi.fn(), create: vi.fn(), update: vi.fn(), deleteOne: vi.fn(), getApiUrl: () => "https://api.example.test" };
 render(<MemoryRouter><Refine dataProvider={provider}><ModerationList /></Refine></MemoryRouter>);
 expect(await screen.findByText("Alexandre")).toBeInTheDocument();
 expect(screen.queryByText("Mission 1")).not.toBeInTheDocument();
 expect(screen.getByText("4,3/5")).toBeInTheDocument();
 expect(screen.getByText("Cuisine 5 · Cadre 4 · Service 4")).toBeInTheDocument();
 expect(getList.mock.lastCall?.[0].meta.select).toContain("review_author_attributions");
});
