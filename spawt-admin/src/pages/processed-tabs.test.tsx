import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Refine, type DataProvider } from "@refinedev/core";
import { MemoryRouter } from "react-router";
import { SuggestionsList } from "./suggestions";
import { PaiementsList } from "./paiements";

vi.mock("../lib/audit", () => ({ logAuditActionBestEffort: vi.fn() }));
vi.mock("../components/PlaceForm", () => ({ ABIDJAN_NEIGHBORHOODS: [] }));
vi.mock("../utility/supabaseClient", () => ({ supabaseClient: {} }));
afterEach(cleanup);

describe("onglets traités", () => {
  it.each([
    ["suggestions", SuggestionsList, ["approved", "rejected"]],
    ["paiements", PaiementsList, ["approved", "rejected", "cancelled"]],
  ] as const)("%s remplace le filtre initial sans le rendre contradictoire", async (_label, Page, statuses) => {
    const getList = vi.fn().mockResolvedValue({ data: [], total: 0 });
    const provider: DataProvider = { getList, getOne: vi.fn(), create: vi.fn(), update: vi.fn(), deleteOne: vi.fn(), getApiUrl: () => "https://api.example.test" };
    render(<MemoryRouter><Refine dataProvider={provider}><Page /></Refine></MemoryRouter>);
    await waitFor(() => expect(getList).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Traitées" }));
    await waitFor(() => expect(getList.mock.lastCall?.[0].filters).toEqual([
      { field: "status", operator: "in", value: [...statuses] },
    ]));
  });
});
