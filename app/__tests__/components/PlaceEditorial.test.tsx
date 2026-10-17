import TestRenderer, { act } from "react-test-renderer";
import { PlaceEditorial } from "../../src/components/place/PlaceEditorial";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { DataLoadNotice } from "../../src/components/DataLoadNotice";
import { EditorialProfileSchema } from "../../src/types/place.schema";
const mockList = jest.fn();
jest.mock("../../src/lib/data-source", () => ({ listEditorialReviews: (...args: unknown[]) => mockList(...args) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (s: string) => s }) }));
let tree: TestRenderer.ReactTestRenderer;
const profile = { identity: "Cuisine de terrain", verified_on: "2026-10-17", sections: [{ title: "Notre repère", body: "Texte serveur" }] };
afterEach(() => { if (tree) act(() => tree.unmount()); jest.clearAllMocks(); });
const render = (id = "one") => <ThemeProvider><PlaceEditorial place={{ id, editorial_profile: profile }} /></ThemeProvider>;
it("renders server-authored sections without community counters or internal source", async () => {
  mockList.mockResolvedValue([{ id: "r", display_name: "Rédaction", body: "Visite vécue", visited_on: "2026-10-16" }]);
  await act(async () => { tree = TestRenderer.create(render()); });
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain("Texte serveur"); expect(output).toContain("Visite vécue"); expect(output).not.toContain("total_reviews");
  expect(EditorialProfileSchema.parse({ ...profile, verification_source: "private" })).not.toHaveProperty("verification_source");
});
it("keeps profile on review error and retries", async () => {
  mockList.mockRejectedValue(new Error("offline"));
  await act(async () => { tree = TestRenderer.create(render()); });
  expect(tree.root.findByType(DataLoadNotice).props.failed).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain("Cuisine de terrain");
  mockList.mockResolvedValue([]);
  await act(async () => tree.root.findByType(DataLoadNotice).props.onRetry());
  expect(tree.root.findByType(DataLoadNotice).props.failed).toBe(false);
});
it("ignores stale reviews after opening another place", async () => {
  let resolve!: (v: unknown[]) => void;
  mockList.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValue([]);
  await act(async () => { tree = TestRenderer.create(render()); });
  await act(async () => { tree.update(render("two")); });
  await act(async () => resolve([{ id: "old", body: "Stale review", visited_on: "2026-10-16", display_name: "Old" }]));
  expect(JSON.stringify(tree.toJSON())).not.toContain("Stale review");
});
