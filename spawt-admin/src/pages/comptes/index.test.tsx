import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Refine, type DataProvider, type GetListParams } from "@refinedev/core";
import { MemoryRouter } from "react-router";
import { ComptesList } from "./index";

afterEach(cleanup);
it("le filtre démo ne confond pas comptes fondateurs et accès internes", async () => {
  const getList = vi.fn().mockImplementation(({ filters }: GetListParams) => {
    const rows = [
      { id: "demo", display_name: "Alpha Démo", is_demo: true, is_seed: false, is_internal: true },
      { id: "seed", display_name: "Avis fondateurs", is_demo: false, is_seed: true, is_internal: false },
      { id: "staff", display_name: "Équipe réelle", is_demo: false, is_seed: false, is_internal: true },
    ];
    const demoOnly = filters?.some((filter) => "field" in filter && filter.field === "is_demo" && filter.value === true);
    return Promise.resolve({ data: (demoOnly ? rows.filter((row) => row.is_demo) : rows).map((row) => ({ ...row, phone_e164: "+2250700000001", stade: "touriste", total_spawts: 0, warning_count: 0, is_banned: false })), total: demoOnly ? 1 : 3 });
  });
  const provider: DataProvider = { getList, getOne: vi.fn(), create: vi.fn(), update: vi.fn(), deleteOne: vi.fn(), getApiUrl: () => "https://api.example.test" };
  render(<MemoryRouter><Refine dataProvider={provider}><ComptesList /></Refine></MemoryRouter>);
  await screen.findByText("Équipe réelle");
  fireEvent.change(screen.getByRole("combobox", { name: "Type de compte" }), { target: { value: "demo" } });
  await waitFor(() => expect(screen.queryByText("Équipe réelle")).not.toBeInTheDocument());
  expect(screen.queryByText("Avis fondateurs")).not.toBeInTheDocument();
  expect(screen.getByText("Alpha Démo")).toBeInTheDocument();
});
