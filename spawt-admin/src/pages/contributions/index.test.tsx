import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ContributionsList } from "./index";
const mock = vi.hoisted(() => ({ role: "operator", rows: [] as unknown[], rpc: vi.fn(), photos: vi.fn() }));
vi.mock("@refinedev/core", () => ({ useGetIdentity: () => ({ data: { role: mock.role } }) }));
vi.mock("../../utility/supabaseClient", async () => {
  const { createFromMock } = await import("../../test/supabaseMock");
  return { supabaseClient: { rpc: mock.rpc, storage: { from: () => ({ createSignedUrls: mock.photos }) }, from: createFromMock(ctx => {
    if (ctx.table === "place_contributions") return { data: mock.rows, error: null };
    if (ctx.table === "places") return { data: { id: "place", name: "Lieu de recette", updated_at: "2026-10-19T20:00:00Z", lat: null, lng: null, price_tier: null, avg_ticket_xof: null, menu_urls: [] }, error: null };
    return { data: [], error: null };
  }) } };
});
beforeEach(() => {
  mock.role = "operator"; mock.rpc.mockReset(); mock.photos.mockReset();
  mock.rows = [{ id: "contribution-id", place_id: "place", spawter_id: "owner", kind: "location", proposal: { lat: 5.3, lng: -4, accuracy_meters: 10, observed_at: "2026-10-19T20:00:00Z" }, comment: "Entrée", status: "pending", offered_reward_paws: 5, reward_paws: 0, created_at: "2026-10-19T20:00:00Z" }];
});
afterEach(cleanup);
const mount = () => render(<MemoryRouter><ContributionsList /></MemoryRouter>);
describe("ContributionsList", () => {
  it("sends approved values and the reviewed place version to the atomic RPC", async () => {
    mock.rpc.mockResolvedValue({ data: { status: "approved", reward_paws: 5 }, error: null }); mount();
    const approve = await screen.findByRole("button", { name: "Valider et attribuer 5 Paws" });
    await waitFor(() => expect(approve).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Latitude retenue"), { target: { value: "5.31" } }); fireEvent.click(approve);
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("moderate_place_contribution", { p_id: "contribution-id", p_decision: "approved", p_note: "", p_expected_place_updated_at: "2026-10-19T20:00:00Z", p_values: { lat: 5.31, lng: -4 } }));
    expect(screen.queryByText("Récompenses des contributions")).not.toBeInTheDocument();
  });
  it("requires a rejection reason and preserves it after a conflict", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: "40001" } }); mount();
    await screen.findByText(/Position du lieu · Lieu de recette/);
    const reject = screen.getByRole("button", { name: "Ne pas retenir (motif requis)" }); expect(reject).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Message au spawter"), { target: { value: "Position à vérifier" } }); fireEvent.click(reject);
    await screen.findByText(/La fiche a changé pendant l’examen/);
    expect(screen.getByLabelText("Message au spawter")).toHaveValue("Position à vérifier");
  });
  it("prevents approval when private menu proofs cannot be loaded", async () => {
    mock.rows = [{ ...(mock.rows[0] as object), kind: "menu", proposal: { photo_paths: ["private/image.jpg"] } }];
    mock.photos.mockResolvedValue({ data: [{ error: "denied" }], error: null }); mount();
    await screen.findByText(/La fiche ou ses preuves n’ont pas pu être chargées/);
    expect(screen.getByRole("button", { name: "Valider et attribuer 5 Paws" })).toBeDisabled();
  });
});
