import { type ReactNode } from "react";
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("../../src/lib/data-source", () => ({ listPlaces: jest.fn(async () => []) }));
const mockState = { savedPlaceIds: new Set(), savedUnavailable: false, refreshSaved: jest.fn(async () => undefined), toggleSaved: jest.fn() };
jest.mock("../../src/store/spawter-store", () => ({ useSpawterStore: (select: (s: typeof mockState) => unknown) => select(mockState) }));
import SavedScreen from "../../app/saved";
beforeEach(() => { jest.clearAllMocks(); });
it("une lecture impossible ne devient pas un faux état vide et propose une reprise", async () => {
  mockState.savedUnavailable = true;
  let rendered!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => { rendered = TestRenderer.create(<SavedScreen />); });
  const content = JSON.stringify(rendered.toJSON());
  expect(content).toContain("saved.unavailable");
  expect(content).not.toContain("saved.empty_title");
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
  expect(JSON.stringify(rendered.toJSON())).toContain("saved.empty_title");
  expect(JSON.stringify(rendered.toJSON())).not.toContain("saved.unavailable");
  TestRenderer.act(() => rendered.unmount());
});
