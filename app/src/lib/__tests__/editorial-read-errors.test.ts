const mockResponses: Record<
  string,
  { data: unknown[] | null; error: { message: string } | null }
> = {};
function mockBuilder(table: string) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"])
    b[method] = jest.fn(() => b);
  b.then = (resolve: (value: unknown) => unknown) =>
    resolve(mockResponses[table] ?? { data: [], error: null });
  return b;
}
jest.mock("../supabase", () => ({
  supabase: { from: jest.fn((table: string) => mockBuilder(table)) },
}));
import { listExploreCollectionsFromSupabase } from "../data-source.supabase";
import { listCommunityPageFromSupabase } from "../community.supabase";
afterEach(() => {
  for (const key of Object.keys(mockResponses)) delete mockResponses[key];
});
it("distinguishes unavailable collections from a published empty list", async () => {
  mockResponses.explore_collections = {
    data: null,
    error: { message: "offline" },
  };
  await expect(
    listExploreCollectionsFromSupabase({ throwOnError: true })
  ).rejects.toEqual({ message: "offline" });
  await expect(listExploreCollectionsFromSupabase()).resolves.toEqual([]); // legacy caller contract
  mockResponses.explore_collections = { data: [], error: null };
  await expect(
    listExploreCollectionsFromSupabase({ throwOnError: true })
  ).resolves.toEqual([]);
});
it.each(["public_reviews", "coups_de_coeur"])(
  "does not disguise %s read failures as an empty community",
  async (table) => {
    mockResponses[table] = { data: null, error: { message: "offline" } };
    await expect(listCommunityPageFromSupabase()).rejects.toEqual({
      message: "offline",
    });
  }
);
