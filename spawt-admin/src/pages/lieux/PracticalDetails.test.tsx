import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PracticalDetails } from "./PracticalDetails";
import { createFromMock, type MockResult } from "../../test/supabaseMock";

const api = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("../../utility/supabaseClient", () => ({ supabaseClient: api }));
let role: string;
let snapshot: MockResult;
let execute: ReturnType<typeof vi.fn>;
beforeEach(() => {
  role = "operator";
  snapshot = { data: null, error: null };
  execute = vi.fn().mockResolvedValue({ data: 1, error: null });
  api.from.mockImplementation(createFromMock(() => snapshot));
  api.rpc.mockImplementation((method, params) =>
    method === "current_staff"
      ? { maybeSingle: () => Promise.resolve({ data: { role }, error: null }) }
      : execute(method, params)
  );
});
afterEach(cleanup);

it("enregistre les sources en brouillon pour le staff et réserve la publication à l’administration", async () => {
  render(<PracticalDetails placeId="lieu" />);
  const save = await screen.findByRole("button", { name: "Enregistrer le brouillon" });
  expect(screen.queryByRole("button", { name: "Publier les informations" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Site officiel"), { target: { value: "https://www.example.com/" } });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une source" }));
  const row = within(screen.getByRole("group", { name: "Source 1" }));
  fireEvent.change(row.getByLabelText("Libellé"), { target: { value: "Contact" } });
  fireEvent.change(row.getByLabelText("Page consultée"), {
    target: { value: "https://www.example.com/contact/" },
  });
  fireEvent.change(row.getByLabelText("Vérifiée le"), { target: { value: "2026-11-26" } });
  fireEvent.click(row.getByLabelText("Site officiel"));
  fireEvent.click(save);
  expect(await screen.findByText("Brouillon enregistré.")).toBeVisible();
  expect(execute).toHaveBeenCalledWith(
    "save_place_practical",
    expect.objectContaining({
      p_place_id: "lieu",
      p_expected_revision: 0,
      p_action: "draft",
      p_document: expect.objectContaining({
        website_url: "https://www.example.com/",
        sources: [
          {
            label: "Contact",
            url: "https://www.example.com/contact/",
            checked_on: "2026-11-26",
            fields: ["website_url"],
          },
        ],
      }),
    })
  );
  expect(screen.getByText("Aucune version publique.")).toBeVisible();
});

it("affiche un conflit sans écraser le brouillon et recharge la version courante", async () => {
  role = "admin";
  snapshot = {
    data: { draft: { website_url: "https://v1.example/" }, published_document: {}, revision: 3 },
    error: null,
  };
  execute.mockResolvedValueOnce({ data: null, error: { code: "40001", message: "concurrent_edit" } });
  render(<PracticalDetails placeId="lieu" />);
  fireEvent.click(await screen.findByRole("button", { name: "Publier les informations" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Une autre personne");
  expect(execute).toHaveBeenLastCalledWith(
    "save_place_practical",
    expect.objectContaining({ p_expected_revision: 3, p_action: "publish" })
  );
  snapshot = {
    data: { draft: { website_url: "https://v2.example/" }, published_document: {}, revision: 4 },
    error: null,
  };
  fireEvent.click(screen.getByRole("button", { name: "Recharger la fiche" }));
  expect(await screen.findByDisplayValue("https://v2.example/")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Publier les informations" }));
  expect(await screen.findByText("Informations publiées.")).toBeVisible();
  expect(execute).toHaveBeenLastCalledWith(
    "save_place_practical",
    expect.objectContaining({ p_expected_revision: 4, p_action: "publish" })
  );
});
