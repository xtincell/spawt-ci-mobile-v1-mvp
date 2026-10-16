import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";
import { SpotsMap } from "../../src/components/SpotsMap";
import CarteScreen from "../../app/(tabs)/carte";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
const mockPush = jest.fn();
const mockTrack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, [fn]),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../src/lib/analytics", () => ({
  track: (...a: unknown[]) => mockTrack(...a),
}));
jest.mock("../../src/components/DataSourceBanner", () => ({
  DataSourceBanner: () => null,
}));
let mockFailed = false;
let mockLoading = false;
const mockReload = jest.fn();
let mockPlaces = [
  {
    id: "published",
    name: "Lieu publié",
    is_published: true,
    cover_photo_url: null,
    location: { lat: 5.35, lng: -3.98, neighborhood: "Cocody" },
  },
];
jest.mock("../../src/lib/use-places", () => ({
  usePlaces: () => ({
    places: mockPlaces,
    loading: mockLoading,
    failed: mockFailed,
    reload: mockReload,
  }),
}));
jest.mock("../../src/lib/use-spawter-position", () => ({
  useSpawterPosition: () => ({ lat: 5.35, lng: -4, source: "fallback" }),
}));
jest.mock("@maplibre/maplibre-react-native", () => ({
  Map: "Map",
  Camera: "Camera",
  Marker: "Marker",
}));
let tree: TestRenderer.ReactTestRenderer;
afterEach(() => {
  if (tree) act(() => tree.unmount());
});
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "android";
  mockFailed = false;
  mockLoading = false;
  mockPlaces = mockPlaces.filter((place) => place.id === "published");
});
it("shares the native map with Carte and retains the city fallback when GPS permission is absent", async () => {
  await act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <CarteScreen />
      </ThemeProvider>,
    );
  });
  expect(tree.root.findAllByType(SpotsMap)).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain("carte.city_fallback");
  const marker = tree.root.find((n) => n.type === ("Marker" as any));
  expect(marker.props.lngLat).toEqual([-3.98, 5.35]);
  const button = marker.find(
    (n) =>
      n.props.accessibilityRole === "button" &&
      typeof n.props.onPress === "function",
  );
  expect(button.props.style.minHeight).toBeGreaterThanOrEqual(44);
  act(() => {
    marker.props.onPress();
    button.props.onPress();
  });
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith("/place/published");
});
it("shows module-unavailable on web, never a schematic map", async () => {
  Platform.OS = "web";
  await act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <SpotsMap embedded />
      </ThemeProvider>,
    );
  });
  expect(JSON.stringify(tree.toJSON())).toContain("carte.module_unavailable");
  expect(
    tree.root.findAll((n) => n.props.testID === "carte-mapview"),
  ).toHaveLength(0);
});
it("offers retry when inventory fails", async () => {
  mockFailed = true;
  await act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <SpotsMap embedded />
      </ThemeProvider>,
    );
  });
  const retry = tree.root.findAll(
    (n) =>
      n.props.accessibilityLabel === "common.retry" &&
      typeof n.props.onPress === "function",
  )[0]!;
  act(() => retry.props.onPress());
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it("keeps real published places usable when the native map is unavailable", async () => {
  Platform.OS = "web";
  mockPlaces.push({
    ...mockPlaces[0]!,
    id: "draft",
    name: "Hidden draft",
    is_published: false,
  });
  await act(async () => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <SpotsMap embedded />
      </ThemeProvider>,
    );
  });
  const content = JSON.stringify(tree.toJSON());
  expect(content).toContain("Lieu publié");
  expect(content).toContain("Cocody");
  expect(content).not.toContain("Hidden draft");
  expect(content).not.toContain("km");
  const link = tree.root.findAll(
    (n) =>
      n.props.accessibilityLabel === "rapide.card_open_aria" &&
      typeof n.props.onPress === "function",
  )[0]!;
  act(() => {
    link.props.onPress();
    link.props.onPress();
  });
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith("/place/published");
});
