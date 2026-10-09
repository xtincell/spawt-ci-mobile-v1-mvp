import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFromMock, type MockQueryCtx } from "../../test/supabaseMock";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../../utility/supabaseClient", () => ({ supabaseClient: { from } }));
import { loadDashboard } from "./index";

describe("lecture des métriques", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("remonte une erreur de lecture au lieu d'afficher de faux zéros", async () => {
    from.mockImplementation(createFromMock(({ table }) => ({
      data: null,
      error: table === "spawters" ? { message: "permission denied for table spawters" } : null,
    })));
    await expect(loadDashboard()).rejects.toThrow("permission denied for table spawters");
  });

  it("exclut les comptes fondateurs et démos alpha des inscriptions", async () => {
    const calls: MockQueryCtx[] = [];
    from.mockImplementation(createFromMock((ctx) => {
      calls.push(ctx);
      const isDaily = ctx.table === "spawters" && ctx.calls.select?.[0]?.[0] === "created_at";
      const excludesSeed = ctx.calls.eq?.some(([field, value]) => field === "is_seed" && value === false);
      const excludesDemo = ctx.calls.eq?.some(([field, value]) => field === "is_demo" && value === false);
      return { data: isDaily ? [{ created_at: "2026-10-09T10:00:00Z" }, ...(!excludesSeed || !excludesDemo ? [{ created_at: "2026-10-09T11:00:00Z" }] : [])] : [], count: 1, error: null };
    }));
    const data = await loadDashboard();
    expect(data.spawtersDaily).toEqual([{ date: "2026-10-09", count: 1 }]);
    for (const ctx of calls.filter((entry) => entry.table === "spawters")) {
      expect(ctx.calls.eq).toContainEqual(["is_demo", false]);
      expect(ctx.calls.eq).toContainEqual(["is_seed", false]);
    }
    const flagged = calls.find((ctx) => ctx.calls.not?.some(([field]) => field === "flag_reason"));
    expect(flagged?.calls.eq).toContainEqual(["is_seed", false]);
  });
});
