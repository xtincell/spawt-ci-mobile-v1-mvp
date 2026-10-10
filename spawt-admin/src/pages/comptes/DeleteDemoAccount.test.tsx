import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteDemoAccount } from "./DeleteDemoAccount";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), navigate: vi.fn(), invalidate: vi.fn() }));
vi.mock("../../utility/supabaseClient", () => ({ supabaseClient: { rpc: mocks.rpc } }));
vi.mock("@refinedev/core", () => ({ useInvalidate: () => mocks.invalidate }));
vi.mock("react-router", () => ({ useNavigate: () => mocks.navigate }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: { ok: true, spawter_id: "demo-id" }, error: null });
  mocks.invalidate.mockResolvedValue(undefined);
});

function confirmForm() {
  render(<DeleteDemoAccount id="demo-id" displayName="Alpha Démo 01" />);
  fireEvent.click(screen.getByRole("button", { name: "Supprimer ce compte démo" }));
  return screen.getByRole("textbox", { name: "Nom du compte à supprimer" });
}

describe("suppression explicite d'un compte démo", () => {
  it("ne supprime qu'après saisie du nom exact puis confirmation", async () => {
    const input = confirmForm();
    const button = screen.getByRole("button", { name: "Supprimer définitivement" });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "Alpha" } });
    expect(button).toBeDisabled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Alpha Démo 01" } });
    fireEvent.click(button);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/comptes"));
    expect(mocks.rpc).toHaveBeenCalledWith("admin_delete_demo_spawter", { p_spawter_id: "demo-id", p_confirmation: "Alpha Démo 01" });
  });

  it("laisse le compte affiché et remonte le refus du serveur", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "demo_only" } });
    fireEvent.change(confirmForm(), { target: { value: "Alpha Démo 01" } });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Seuls les comptes marqués Démo alpha peuvent être supprimés.");
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("annuler ne déclenche aucune requête de suppression", () => {
    confirmForm();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Supprimer ce compte démo" })).toBeVisible();
  });
});
