import TestRenderer, { act } from "react-test-renderer";
import { AppState, Platform } from "react-native";
import { SpotsMap } from "../../src/components/SpotsMap";
import CarteScreen from "../../app/(tabs)/carte";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
const mockPush = jest.fn();
const mockTrack = jest.fn();
const mockCanRender = jest.fn();
let mockFocused = true;
let mockPosition = { lat: 5.35, lng: -4, source: "fallback" };
jest.mock("expo", () => {
  const expo = jest.requireActual("expo");
  return {
    ...expo,
    requireOptionalNativeModule: (name: string) =>
      name === "SpawtMapCapabilities"
        ? { canRenderAsync: () => mockCanRender() }
        : expo.requireOptionalNativeModule(name),
  };
});
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (fn: () => void) =>
    require("react").useEffect(
      () => (mockFocused ? fn() : undefined),
      [fn, mockFocused],
    ),
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
const mockPublishedPlaces = [
  {
    id: "published",
    name: "Lieu publié",
    is_published: true,
    cover_photo_url: null,
    location: { lat: 5.35, lng: -3.98, neighborhood: "Cocody" },
  },
];
let mockPlaces = [...mockPublishedPlaces];
jest.mock("../../src/lib/use-places", () => ({
  usePlaces: () => ({
    places: mockPlaces,
    loading: mockLoading,
    failed: mockFailed,
    reload: mockReload,
  }),
}));
jest.mock("../../src/lib/use-spawter-position", () => ({
  useSpawterPosition: () => mockPosition,
}));
jest.mock("@maplibre/maplibre-react-native", () => ({
  Map: "Map",
  Camera: "Camera",
  GeoJSONSource: "GeoJSONSource",
  Layer: "Layer",
}));
let tree: TestRenderer.ReactTestRenderer;
afterEach(() => {
  if (tree) act(() => tree.unmount());
  jest.restoreAllMocks();
});
beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "android";
  AppState.currentState = "active";
  jest
    .spyOn(AppState, "addEventListener")
    .mockReturnValue({ remove: jest.fn() });
  mockFailed = false;
  mockLoading = false;
  mockFocused = true;
  mockCanRender.mockResolvedValue(true);
  mockPosition = { lat: 5.35, lng: -4, source: "fallback" };
  mockPlaces = [...mockPublishedPlaces];
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
  expect(JSON.stringify(tree.toJSON())).not.toContain("carte.city_fallback");
  expect(
    tree.root.findByType("Camera" as any).props.initialViewState.center,
  ).toEqual([-4.0267, 5.3364]);
  const map = tree.root.findByType("Map" as any);
  expect(map.props.androidView).toBe("texture");
  expect(map.props.mapStyle).toMatch(/positron$/);
  expect(tree.root.findAllByType("GeoJSONSource" as any)).toHaveLength(0);
  act(() => map.props.onDidFinishLoadingStyle());
  const source = tree.root.findByType("GeoJSONSource" as any);
  const feature = source.props.data.features[0];
  expect(feature.geometry.coordinates).toEqual([-3.98, 5.35]);
  act(() => {
    source.props.onPress({ nativeEvent: { features: [feature] } });
    source.props.onPress({ nativeEvent: { features: [feature] } });
  });
  expect(mockPush).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain("Cocody");
  const dismiss = tree.root.findAllByProps({
    testID: "carte-close-selected",
  })[0]!;
  act(() => dismiss.props.onPress());
  expect(
    tree.root.findAllByProps({ testID: "carte-selected-place" }),
  ).toHaveLength(0);
  act(() => source.props.onPress({ nativeEvent: { features: [feature] } }));
  const open = tree.root.findAllByProps({ testID: "carte-open-selected" })[0]!;
  act(() => {
    open.props.onPress();
    open.props.onPress();
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

const mapScreen = () => (
  <ThemeProvider>
    <CarteScreen />
  </ThemeProvider>
);

it.each([
  { latitude: 5.36, longitude: -3.99, expected: [-3.99, 5.36] },
  { latitude: 37.42, longitude: -122.08, expected: [-4.0267, 5.3364] },
])(
  "opens on useful local coordinates when a GPS fix is available",
  async ({ latitude, longitude, expected }) => {
    mockPosition = { lat: latitude, lng: longitude, source: "gps" };
    await act(async () => {
      tree = TestRenderer.create(mapScreen());
    });
    expect(
      tree.root.findByType("Camera" as any).props.initialViewState.center,
    ).toEqual(expected);
  },
);

it("distinguishes unknown inventory at startup from a confirmed empty selection", async () => {
  mockPlaces = [];
  mockLoading = true;
  await act(async () => {
    tree = TestRenderer.create(mapScreen());
  });
  expect(
    tree.root.findAllByProps({ testID: "carte-inventory-count" }),
  ).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain("carte.loading_places");
  expect(JSON.stringify(tree.toJSON())).not.toContain("carte.empty");
  mockPlaces = [...mockPublishedPlaces];
  act(() => tree.update(mapScreen()));
  expect(
    tree.root.findAllByProps({ testID: "carte-inventory-count" }).length,
  ).toBeGreaterThan(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain("carte.loading_places");
  mockLoading = false;
  act(() =>
    tree.root
      .findAllByProps({ testID: "carte-filter-mine" })[0]!
      .props.onPress(),
  );
  expect(JSON.stringify(tree.toJSON())).toContain("carte.empty_filter");
  const all = tree.root.findAll(
    (n) =>
      n.props.accessibilityLabel === "carte.filters.all" &&
      typeof n.props.onPress === "function",
  )[0]!;
  act(() => all.props.onPress());
  expect(JSON.stringify(tree.toJSON())).not.toContain("carte.empty_filter");
});

it("makes published addresses without coordinates available directly in the list", async () => {
  const place = mockPlaces[0]!;
  mockPlaces = [{ ...place, location: { ...place.location, lat: 0, lng: 0 } }];
  await act(async () => {
    tree = TestRenderer.create(mapScreen());
  });
  expect(JSON.stringify(tree.toJSON())).toContain("carte.unmapped_selection");
  act(() =>
    tree.root
      .findAllByProps({ testID: "carte-view-toggle" })[0]!
      .props.onPress(),
  );
  expect(
    tree.root.findAllByProps({ children: "Lieu publié" }).length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAllByProps({ children: "carte.unmapped_selection" }),
  ).toHaveLength(0);
});

it("keeps a complete inventory with a single source and excludes invalid coordinates from the renderer", async () => {
  const first = mockPlaces[0]!;
  const supported = Array.from({ length: 154 }, (_, index) => ({
    ...first,
    id: "point-" + index,
  }));
  mockPlaces.push(...supported);
  for (const [lat, lng] of [
    [91, 20],
    [10, -182],
    [0, 0],
    [Infinity, 5],
    [5, NaN],
  ] as const) {
    mockPlaces.push({
      ...first,
      id: "bad-" + mockPlaces.length,
      location: { ...first.location, lat, lng },
    });
  }
  mockPosition = { lat: 100, lng: NaN, source: "gps" };
  await act(async () => {
    tree = TestRenderer.create(mapScreen());
  });
  expect(
    tree.root.findByType("Camera" as any).props.initialViewState.center,
  ).toEqual([-4.0267, 5.3364]);
  act(() => tree.root.findByType("Map" as any).props.onDidFinishLoadingStyle());
  const source = tree.root.findByType("GeoJSONSource" as any);
  expect(source.props.data.features).toHaveLength(155);
  expect(tree.root.findAllByType("Layer" as any)).toHaveLength(2);
  expect(tree.root.findAllByType("Marker" as any)).toHaveLength(0);
  act(() =>
    source.props.onPress({
      nativeEvent: { features: [{ properties: { placeId: "inactive" } }] },
    }),
  );
  expect(mockPush).not.toHaveBeenCalled();
});

it("shows real places without mounting MapLibre on an Android without the necessary graphics", async () => {
  mockCanRender.mockResolvedValue(false);
  await act(async () => {
    tree = TestRenderer.create(mapScreen());
  });
  expect(tree.root.findAllByType("Map" as any)).toHaveLength(0);
  expect(
    tree.root.findAllByProps({ children: "Lieu publié" }).length,
  ).toBeGreaterThan(0);
});

it("returns to the list on style failure and lets the visitor retry the map", async () => {
  await act(async () => {
    tree = TestRenderer.create(mapScreen());
  });
  act(() => tree.root.findByType("Map" as any).props.onDidFailLoadingMap());
  expect(tree.root.findAllByType("Map" as any)).toHaveLength(0);
  expect(
    tree.root.findAllByProps({ children: "Lieu publié" }).length,
  ).toBeGreaterThan(0);
  act(() =>
    tree.root
      .findAllByProps({ testID: "carte-view-toggle" })[0]!
      .props.onPress(),
  );
  expect(tree.root.findAllByType("Map" as any)).toHaveLength(1);
});

it("releases the native surface on loss of focus and on Android backgrounding", async () => {
  const subscription = jest.spyOn(AppState, "addEventListener");
  try {
    await act(async () => {
      tree = TestRenderer.create(mapScreen());
    });
    const change = subscription.mock.calls.find(
      ([name]) => name === "change",
    )![1] as (state: string) => void;
    act(() => change("background"));
    expect(tree.root.findAllByType("Map" as any)).toHaveLength(0);
    act(() => change("active"));
    expect(tree.root.findAllByType("Map" as any)).toHaveLength(1);
    mockFocused = false;
    act(() => tree.update(mapScreen()));
    expect(tree.root.findAllByType("Map" as any)).toHaveLength(0);
    mockFocused = true;
    act(() => tree.update(mapScreen()));
    expect(tree.root.findAllByType("Map" as any)).toHaveLength(1);
  } finally {
    subscription.mockRestore();
  }
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
