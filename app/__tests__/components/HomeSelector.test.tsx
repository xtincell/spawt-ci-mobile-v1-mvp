const mockOutings = { snapshot: { dismissed: [] } };
jest.mock("../../src/store/outings-store", () => ({ useOutings: () => mockOutings }));
jest.mock("../../src/components/OutingDiscovery", () => ({ EditorialDiscovery: () => null, OutingDiscovery: () => null }));
jest.mock("../../src/components/RapideContent", () => ({
  RapideContent: () => null,
}));
jest.mock("../../src/components/SpotsMap", () => ({ SpotsMap: () => null }));
jest.mock("../../src/components/ExploreCollections", () => ({
  ExploreCollections: () => null,
  DuoEditorial: () => null,
}));
import TestRenderer, { act } from "react-test-renderer";
import HomeD from "../../app/(tabs)";
import { ModeStories } from "../../src/components/ModeStories";
import { HomeEditorial } from "../../src/components/HomeEditorial";
import { FeuilletonRow } from "../../src/components/FeuilletonRow";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { listPlaces } from "../../src/lib/data-source";
import {
  EMPTY_PALAIS,
  SAMPLE_SPAWTER,
} from "../../src/data/seed/sample-spawter";
import { selectHomeEditorial } from "../../src/lib/home-editorial";
import type { PlaceWithAdn } from "../../src/lib/data-source";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    require("react").useEffect(effect, [effect]),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("../../src/components/HomeEditorial", () => ({
  HomeEditorial: () => null,
}));
jest.mock("../../src/components/FeuilletonRow", () => ({
  FeuilletonRow: () => null,
}));
jest.mock("../../src/components/GoldUpsellSheet", () => ({
  GoldUpsellSheet: () => null,
}));
jest.mock("../../src/components/EventsWeekRow", () => ({
  EventsWeekRow: () => null,
}));
const mockPosition = { lat: 5.3599, lng: -4.0083, source: "fallback" };
jest.mock("../../src/lib/use-spawter-position", () => ({
  useSpawterPosition: () => mockPosition,
}));
jest.mock("../../src/store/feature-flags", () => ({ useFlag: () => false }));
const mockState = {
  palais: EMPTY_PALAIS,
  spawter: SAMPLE_SPAWTER,
  spawts: [],
  savedPlaceIds: new Set<string>(),
};
jest.mock("../../src/store/spawter-store", () => ({
  useSpawterStore: (select: any) => select(mockState),
}));
let mockPlaces: PlaceWithAdn[] = [];
jest.mock("../../src/lib/use-places", () => ({
  usePlaces: () => ({
    places: mockPlaces,
    loading: false,
    failed: false,
    reload: jest.fn(),
  }),
}));

it("keeps Suggestions mounted and unchanged across independent usages; every feed id, rank and score survives repeated selections and navigation", async () => {
  mockPlaces = await listPlaces();
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <HomeD />
      </ThemeProvider>,
    );
  });
  const feed = () => tree.root.findByType(FeuilletonRow).props.places;
  const initial = feed();
  const snapshot = initial.map((p: any) => [p.place.id, p.match_score]);
  expect(initial).toHaveLength(mockPlaces.length);
  expect(tree.root.findByType(ModeStories).props.selectedMode).toBe(
    "suggestions",
  );
  const original = selectHomeEditorial(initial, "suggestions");
  for (const mode of [
    "rapide",
    "duo",
    "spots",
    "selections",
    "selections",
    "suggestions",
  ] as const) {
    act(() => tree.root.findByType(ModeStories).props.onModePress(mode));
    expect(feed()).toBe(initial);
    expect(feed().map((p: any) => [p.place.id, p.match_score])).toEqual(
      snapshot,
    );
    expect(tree.root.findByType(HomeEditorial).props.mode).toBe("suggestions");
    expect(
      tree.root.findByProps({ testID: "home-panel-suggestions" }).props.style
        .display,
    ).toBe(mode === "suggestions" ? "flex" : "none");
  }
  expect(selectHomeEditorial(feed(), "suggestions")).toEqual(original);
  expect(selectHomeEditorial(initial, "selections")).toEqual([]);
  act(() => tree.root.findByType(HomeEditorial).props.onPlacePress(initial[0]));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/place/[id]",
    params: { id: initial[0].place.id, ref: "feed" },
  });
  expect(feed()).toBe(initial);
  act(() => tree.unmount());
});
