const mockCalls: { table: string; method: string; args: unknown[] }[] = [];
const mockRows: Record<string, { data: unknown[]; error: unknown }> = {};
jest.mock("../supabase", () => ({
  supabase: {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "or", "order", "limit", "in"])
        builder[method] = (...args: unknown[]) => {
          mockCalls.push({ table, method, args });
          return builder;
        };
      builder.then = (resolve: (value: unknown) => void) =>
        resolve(mockRows[table] ?? { data: [], error: null });
      return builder;
    },
  },
}));
jest.mock("../storage-photos", () => ({
  resolveReviewPhotoUrls: jest.fn(
    async (paths: string[]) => new Map(paths.map((p) => [p, `signed:${p}`]))
  ),
}));
import { listCommunityPageFromSupabase } from "../community.supabase";
import { communityPage, mergeCommunity } from "../community";
import type { MeuteActivityItem } from "../data-source";
const place = {
  name: "Adresse",
  neighborhood: "Cocody",
  cover_photo_url: "https://example.test/cover.jpg",
};
const id = (n: number) =>
  `a1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const review = (n: number) => ({
  id: id(n),
  spawter_id: id(80),
  created_at: "2026-10-13T08:00:00+00:00",
  display_name: "Auteur",
  avatar_url: null,
  places: place,
  place_id: id(99),
  note_etoiles: 4,
  note_globale: 4.3,
  note_cuisine: 5,
  note_cadre: 4,
  note_service: 4,
  photos: ["a/b/0.jpg"],
});
beforeEach(() => {
  mockCalls.length = 0;
  for (const key in mockRows) delete mockRows[key];
});
it("reads other members through the public profile projection and published places only", async () => {
  mockRows.public_reviews = { data: [review(2)], error: null };
  mockRows.coups_de_coeur = {
    data: [{ ...review(3), spawter_id: id(81) }],
    error: null,
  };
  mockRows.spawters_public = {
    data: [{ id: id(81), display_name: "Autre membre", avatar_url: null }],
    error: null,
  };
  const page = await listCommunityPageFromSupabase();
  expect(page.items.map((x) => x.spawter_display_name)).toEqual([
    "Autre membre",
    "Auteur",
  ]);
  expect(page.items[1]).toMatchObject({
    note_globale: 4.3,
    note_cuisine: 5,
    photos: ["signed:a/b/0.jpg"],
    place_cover_photo_url: place.cover_photo_url,
  });
  expect(mockCalls.some((c) => c.table === "spawters")).toBe(false);
  for (const table of ["public_reviews", "coups_de_coeur"])
    expect(mockCalls).toContainEqual({
      table,
      method: "eq",
      args: ["places.is_published", true],
    });
});
it("fills a whole page when all recent activity is reviews; stable tie cursor and no half quota", async () => {
  mockRows.public_reviews = {
    data: [review(4), review(3), review(2)],
    error: null,
  };
  const page = await listCommunityPageFromSupabase({ limit: 2 });
  expect(page.items.map((x) => x.id)).toEqual([id(4), id(3)]);
  expect(page.next).toEqual({ id: id(3), created_at: review(3).created_at });
  await listCommunityPageFromSupabase({
    limit: 2,
    cursor: page.next,
    filter: "review",
  });
  expect(mockCalls.filter((c) => c.method === "or")[0]!.args[0]).toContain(
    `id.lt.${id(3)}`
  );
  expect(
    mockCalls.filter(
      (c) => c.table === "coups_de_coeur" && c.method === "select"
    )
  ).toHaveLength(1);
});
it("handles empty and profile errors without silently fabricating an author", async () => {
  expect(await listCommunityPageFromSupabase()).toEqual({
    items: [],
    next: null,
  });
  mockRows.coups_de_coeur = { data: [review(1)], error: null };
  mockRows.spawters_public = { data: [], error: { message: "offline" } };
  await expect(listCommunityPageFromSupabase()).rejects.toEqual({
    message: "offline",
  });
  await expect(
    listCommunityPageFromSupabase({ cursor: { id: "bad", created_at: "bad" } })
  ).rejects.toThrow("Invalid");
});
it("deduplicates appended pages and orders real timestamps across UTC notations", () => {
  const a = { ...review(1), kind: "review" } as unknown as MeuteActivityItem;
  const b = { ...a, id: id(2), created_at: "2026-10-13T09:00:00Z" };
  expect(communityPage([a, b], 1).items).toEqual([b]);
  expect(mergeCommunity([a], [a, b])).toEqual([a, b]);
});
