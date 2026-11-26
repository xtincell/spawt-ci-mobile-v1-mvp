const mockOutings = { snapshot: { lists: [], items: [], dishes: [] as import("../../src/lib/outings").MenuItem[] },
  pendingPlaces: {}, refresh: jest.fn(), loading: false, failed: false, pending: 0, rejected: 0 };
jest.mock("../../src/store/outings-store", () => ({ useOutings: () => mockOutings }));
jest.mock("../../src/components/OutingActions", () => ({ OutingActions: () => null }));
jest.mock("../../src/lib/use-menu-items", () => ({ useMenuItems: () => ({ items: [] }) }));
import { type ReactNode } from "react";
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({}), useRouter: () => ({ back: jest.fn(), push: mockPush }) }));
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("../../src/lib/data-source", () => ({ listPlaces: jest.fn(async () => []) }));
const mockState = { savedPlaceIds: new Set(), savedUnavailable: false, refreshSaved: jest.fn(async () => undefined), toggleSaved: jest.fn() };
jest.mock("../../src/store/spawter-store", () => ({ useSpawterStore: (select: (s: typeof mockState) => unknown) => select(mockState) }));
import SavedScreen from "../../app/saved";
beforeEach(() => { jest.clearAllMocks(); mockOutings.snapshot.dishes = []; mockOutings.pending = 0; mockOutings.loading = false; mockState.savedUnavailable = false; });

it("ouvre le plat enregistré dans le menu du lieu, y compris quand sa synchronisation est en attente", async () => {
  mockOutings.pending = 1;
  mockOutings.loading = true;
  mockOutings.snapshot.dishes = [{ id:"dish-id", place_id:"place-id", name:"Eggs Benedict", place_name:"IN’ Concept Store",
    price_xof:7000, observed_on:"2026-03-22", photo_url:null, is_published:true }];
  let rendered!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => { rendered = TestRenderer.create(<SavedScreen />); });
  const content = JSON.stringify(rendered.toJSON());
  expect(content).toContain("dish-dish-id");
  expect(content).toContain("saved-sync-status");
  expect(content.indexOf("dish-dish-id")).toBeLessThan(content.indexOf("saved-sync-status"));
  expect(content).not.toContain("common.loading");
  expect(content).not.toContain("saved-empty");
  const dish = rendered.root.findAll((n: {props: {accessibilityLabel?: string; onPress?: unknown}}) =>
    Boolean(n.props.accessibilityLabel?.startsWith("Eggs Benedict. IN’ Concept Store.")) && typeof n.props.onPress === "function");
  expect(dish.length).toBeGreaterThan(0);
  await TestRenderer.act(async () => { dish[0]!.props.onPress(); });
  expect(mockPush).toHaveBeenCalledWith({pathname:"/place/[id]",params:{id:"place-id",tab:"menu",dish:"dish-id"}});
  TestRenderer.act(() => rendered.unmount());
});
it("une lecture impossible ne devient pas un faux état vide et propose une reprise", async () => {
  mockState.savedUnavailable = true;
  let rendered!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => { rendered = TestRenderer.create(<SavedScreen />); });
  const content = JSON.stringify(rendered.toJSON());
  expect(content).toContain("saved.unavailable");
  expect(content).not.toContain("outings.empty");
  const retry = rendered.root.findAllByProps({ accessibilityLabel: "saved.retry" }).find((n: { props: { onPress?: unknown } }) => typeof n.props.onPress === "function");
  expect(retry).toBeDefined();
  await TestRenderer.act(async () => { retry!.props.onPress(); await Promise.resolve(); });
  expect(mockState.refreshSaved).toHaveBeenCalledTimes(1);
  TestRenderer.act(() => rendered.unmount());
});
it("une liste vraiment vide conserve son accueil habituel", async () => {
  mockState.savedUnavailable = false;
  let rendered!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => { rendered = TestRenderer.create(<SavedScreen />); });
  expect(JSON.stringify(rendered.toJSON())).toContain("outings.empty");
  expect(JSON.stringify(rendered.toJSON())).not.toContain("saved.unavailable");
  TestRenderer.act(() => rendered.unmount());
});

it("un inventaire inaccessible ne prétend pas que les favoris sont vides et peut être relancé", async () => {
  const { listPlaces } = jest.requireMock("../../src/lib/data-source") as { listPlaces: jest.Mock };
  mockState.savedUnavailable = false;
  listPlaces.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
  let rendered!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => { rendered = TestRenderer.create(<SavedScreen />); });
  expect(JSON.stringify(rendered.toJSON())).toContain("common.data_read_error");
  expect(JSON.stringify(rendered.toJSON())).not.toContain("outings.empty");
  const retry = rendered.root.findAllByProps({ accessibilityLabel: "common.retry" }).find((n: { props: { onPress?: unknown } }) => typeof n.props.onPress === "function");
  await TestRenderer.act(async () => { retry!.props.onPress(); });
  expect(JSON.stringify(rendered.toJSON())).toContain("outings.empty");
  TestRenderer.act(() => rendered.unmount());
});
