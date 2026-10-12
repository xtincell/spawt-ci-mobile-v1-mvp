import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Refine, type DataProvider, type GetListParams } from "@refinedev/core";
import { MemoryRouter } from "react-router";
import { LieuxList } from "./index";

vi.mock("../../lib/audit", () => ({ logAuditAction: vi.fn() }));
const getList = vi.fn();
const provider: DataProvider = {
  getList,
  getOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteOne: vi.fn(),
  getApiUrl: () => "https://api.example.test",
};
const places = Array.from({ length: 26 }, (_, index) => ({
  id: `place-${index + 1}`, name: `Spot ${index + 1}`, neighborhood: "Cocody",
  cuisine: ["ivoirienne"], price_tier: 1, is_published: true,
}));

function mount() {
  return render(
    <MemoryRouter>
      <Refine dataProvider={provider} options={{ reactQuery: { clientConfig: { defaultOptions: { queries: { retry: false } } } } }}>
        <LieuxList />
      </Refine>
    </MemoryRouter>,
  );
}

afterEach(cleanup);
beforeEach(() => {
  getList.mockReset();
  getList.mockImplementation(({ pagination, filters }: GetListParams) => {
    const search = filters?.find((filter) => "field" in filter && filter.field === "name");
    const matching = search ? places.filter((place) => place.name.includes(String(search.value))) : places;
    const start = ((pagination?.currentPage ?? 1) - 1) * 25;
    return Promise.resolve({ data: matching.slice(start, start + 25), total: matching.length });
  });
});

describe("inventaire paginé", () => {
  it("rend accessibles les lieux après la première page puis revient à la page 1 à la recherche", async () => {
    mount();
    await screen.findByText("Spot 1");
    expect(screen.queryByText("Spot 26")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suivante" }));
    await screen.findByText("Spot 26");
    expect(screen.queryByText("Spot 1")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Rechercher un nom…"), { target: { value: "Spot 1" } });
    await screen.findByText("Spot 1");
    await waitFor(() => expect(getList).toHaveBeenLastCalledWith(expect.objectContaining({ pagination: expect.objectContaining({ currentPage: 1 }) })));
  });

  it("distingue une panne de lecture d'un inventaire vide et permet de réessayer", async () => {
    getList.mockRejectedValueOnce({ message: "Connexion interrompue", statusCode: 503 });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Connexion interrompue");
    expect(screen.queryByText("Aucun résultat pour ces filtres.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await screen.findByText("Spot 1");
  });
});
