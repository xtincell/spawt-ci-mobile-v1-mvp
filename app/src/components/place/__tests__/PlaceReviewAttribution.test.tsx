import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { PlaceReviewAttribution } from "../PlaceReviewAttribution";
import { SpawterAvatar } from "../../SpawterAvatar";
import { getPublicReviewAuthors } from "../../../lib/place-practical";

const mockRead = jest.fn();
jest.mock("../../../lib/data-source", () => ({ isSupabaseConfigured: true }));
jest.mock("../../../lib/supabase", () => ({
  supabase: { from: () => {
    const page = {
      select: () => page, eq: () => page, not: () => page, order: () => page, limit: () => page,
      gt: () => page, abortSignal: () => mockRead(),
    };
    return page;
  } },
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options: { count?: number; score?:string; attribution?:string }) =>
    options.attribution ? options.score + "/5 " + options.attribution : key + " " + options.count }),
}));

const author = (id: string) => ({ spawter_id: id, avatar_url: null });
const open = jest.fn();
function action(tree: ReactTestRenderer) {
  return tree.root.findAll(node => node.props.testID === "place-rating-authors" && !!node.props.onPress)[0]!;
}
async function render(count: number) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PlaceReviewAttribution score={4.1} placeId="lieu" reviewCount={count} revision="1" onPress={open}/>);
  });
  return tree;
}
beforeEach(() => { jest.clearAllMocks(); });

it("represents a returning author once and opens all reviews from one accessible control", async () => {
  mockRead.mockResolvedValue({ data: [author("a"), author("a")], error: null });
  const tree = await render(2);
  expect(tree.root.findAllByType(SpawterAvatar)).toHaveLength(1);
  const button = action(tree);
  expect(button.props.accessibilityLabel).toBe("4,1/5 place.rating_authors 1");
  act(() => button.props.onPress());
  expect(open).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it("shows up to three portraits, the remaining headcount and the real photo when available", async () => {
  const first = { spawter_id: "a", avatar_url: "https://example.org/profile.png" };
  mockRead.mockResolvedValue({ data: [first, first, ...["b","c","d","e"].map(author)], error: null });
  const tree = await render(6);
  const portraits = tree.root.findAllByType(SpawterAvatar);
  expect(portraits.map(node => node.props.url)).toEqual([first.avatar_url, null, null]);
  expect(action(tree).props.accessibilityLabel).toBe("4,1/5 place.rating_authors 5");
  expect(JSON.stringify(tree.toJSON())).toMatch(/"\+","2"/);
  act(() => tree.unmount());
});

it("does not count repeated contributions at the page boundary", async () => {
  mockRead.mockResolvedValueOnce({ data: Array.from({length:250}, () => author("a")), error: null })
    .mockResolvedValueOnce({ data: [author("b")], error: null });
  const summary = await getPublicReviewAuthors("lieu");
  expect(summary?.portraits.map(person => person.id)).toEqual(["a", "b"]);
  expect(summary?.count).toBe(2);
});

it("keeps an unrated place empty and never invents an author when reading fails", async () => {
  const empty = await render(0);
  expect(empty.toJSON()).toBeNull();
  expect(mockRead).not.toHaveBeenCalled();
  mockRead.mockRejectedValueOnce(new Error("offline"));
  const unavailable = await render(3);
  expect(unavailable.root.findAllByType(SpawterAvatar)).toHaveLength(0);
  expect(action(unavailable).props.accessibilityLabel).toBe("4,1/5 place.rating_reviews 3");
  act(() => { empty.unmount(); unavailable.unmount(); });
});
