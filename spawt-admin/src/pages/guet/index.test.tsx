import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GuetPage } from "./index";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../utility/supabaseClient", async () => {
 const { createFromMock } = await import("../../test/supabaseMock");
 return { supabaseClient: {
  rpc: mock.rpc,
  from: createFromMock(ctx => ({
   data: ctx.table === "places" ? [{ id: "place", name: "Lieu cartographié", lat: 5.295409, lng: -3.987762 }] : [],
   error: null,
  })),
 } };
});

beforeEach(() => { mock.rpc.mockReset(); mock.rpc.mockResolvedValue({ error: null }); });
afterEach(cleanup);

async function complete() {
 render(<GuetPage />);
 await screen.findByRole("option", { name: "Lieu cartographié" });
 fireEvent.change(screen.getByLabelText("Lieu"), { target: { value: "place" } });
 fireEvent.change(screen.getByLabelText("Source de localisation"), { target: { value: "https://www.openstreetmap.org/node/123" } });
}

it("submits an unknown map precision as null, never as a zero-metre GPS measurement", async () => {
 await complete();
 expect(screen.getByLabelText(/Précision du relevé/)).not.toBeRequired();
 fireEvent.click(screen.getByRole("button", { name: "Valider les coordonnées affichées" }));
 await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("validate_place_location", {
  p_place_id: "place", p_source: "https://www.openstreetmap.org/node/123", p_accuracy: null,
  p_expected_lat: 5.295409, p_expected_lng: -3.987762,
 }));
});

it("preserves an actual measurement and the displayed coordinate concurrency guard", async () => {
 await complete();
 fireEvent.change(screen.getByLabelText("Source de localisation"), { target: { value: "Relevé GPS documenté" } });
 fireEvent.change(screen.getByLabelText(/Précision du relevé/), { target: { value: "12.5" } });
 fireEvent.click(screen.getByRole("button", { name: "Valider les coordonnées affichées" }));
 await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("validate_place_location", {
  p_place_id: "place", p_source: "Relevé GPS documenté", p_accuracy: 12.5,
  p_expected_lat: 5.295409, p_expected_lng: -3.987762,
 }));
});

it("keeps the source and reports an unconfirmed validation when coordinates changed", async () => {
 await complete();
 mock.rpc.mockResolvedValue({ error: { code: "40001" } });
 fireEvent.click(screen.getByRole("button", { name: "Valider les coordonnées affichées" }));
 await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("La validation n’a pas été confirmée"));
 expect(screen.getByLabelText("Source de localisation")).toHaveValue("https://www.openstreetmap.org/node/123");
 expect(screen.queryByText(/Coordonnées validées et journalisées/)).not.toBeInTheDocument();
});
