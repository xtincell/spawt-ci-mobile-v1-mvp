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
