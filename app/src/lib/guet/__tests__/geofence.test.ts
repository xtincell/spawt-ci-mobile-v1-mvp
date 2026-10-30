// Story 4.1 — Tests unit `geofence.ts`.
// Vise AC #8 (couverture). Mocks expo-location + data-source + feature-flags.

jest.mock("expo-location", () => ({
  __esModule: true,
  GeofencingEventType: { Enter: 1, Exit: 2 },
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  startGeofencingAsync: jest.fn(() => Promise.resolve()),
  stopGeofencingAsync: jest.fn(() => Promise.resolve()),
  hasStartedGeofencingAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock("expo-task-manager", () => ({
  __esModule: true,
  defineTask: jest.fn(),
}));

const mockDataSource = {
  dataSourceMode: "supabase" as "supabase" | "fallback",
};
jest.mock("../../data-source", () => ({
  get dataSourceMode() {
    return mockDataSource.dataSourceMode;
  },
  listFeatureFlags: jest.fn(() => Promise.resolve([])),
  isSupabaseConfigured: true,
  listPlaces: jest.fn(),
  getPlace: jest.fn(),
  listSpawtsForSpawter: jest.fn(),
  saveSpawter: jest.fn(),
  savePalais: jest.fn(),
}));

let mockEnabled = true;
jest.mock("../../../store/feature-flags", () => ({
  useFeatureFlagsStore: {
    getState: () => ({ flags: { "guet-proximity-v2": mockEnabled } }),
  },
}));

import * as Location from "expo-location";
import {
  armGuet,
  disarmGuet,
  isGuetArmed,
  selectClosestPlaces,
  getArmedPlaceIds,
  _resetArmedForTest,
  MAX_ACTIVE_GEOFENCES,
} from "../geofence";

const startMock = Location.startGeofencingAsync as jest.Mock;
const stopMock = Location.stopGeofencingAsync as jest.Mock;
const reqFgMock = Location.requestForegroundPermissionsAsync as jest.Mock;
const getFgMock = Location.getForegroundPermissionsAsync as jest.Mock;
const getBgMock = Location.getBackgroundPermissionsAsync as jest.Mock;
const reqBgMock = Location.requestBackgroundPermissionsAsync as jest.Mock;
const hasStartedMock = Location.hasStartedGeofencingAsync as jest.Mock;
let nativeArmed = false;
const places = [{ id: "p1", lat: 5.35, lng: -3.97 }];
const options = { hasGeolocConsent: true, spawter: { lat: 5.35, lng: -3.97 } };

beforeEach(() => {
  jest.clearAllMocks();
  nativeArmed = false; mockEnabled = true;
  startMock.mockImplementation(async () => { nativeArmed = true; });
  stopMock.mockImplementation(async () => { nativeArmed = false; });
  hasStartedMock.mockImplementation(async () => nativeArmed);
  getFgMock.mockResolvedValue({ status: "granted", canAskAgain: true });
  getBgMock.mockResolvedValue({ status: "granted", canAskAgain: true });
  reqFgMock.mockResolvedValue({ status: "granted" });
  reqBgMock.mockResolvedValue({ status: "granted" });
  mockDataSource.dataSourceMode = "supabase";
  _resetArmedForTest();
});

describe("selectClosestPlaces", () => {
  it("retourne les N plus proches via haversine", () => {
    const spawter = { lat: 5.35, lng: -3.97 }; // Cocody-ish
    const places = [
      { id: "near", lat: 5.351, lng: -3.971 },
      { id: "far", lat: 4.74, lng: -6.62 }, // San-Pédro
      { id: "mid", lat: 5.40, lng: -4.00 },
    ];
    const picked = selectClosestPlaces(places, spawter, 2);
    expect(picked.map((p) => p.id)).toEqual(["near", "mid"]);
  });

  it("retourne tous les lieux si <= max", () => {
    const out = selectClosestPlaces(
      [{ id: "a", lat: 1, lng: 1 }],
      { lat: 0, lng: 0 },
      5,
    );
    expect(out).toHaveLength(1);
  });
});

describe("armGuet", () => {
  it("no-op silencieux si mode démo (fallback)", async () => {
    mockDataSource.dataSourceMode = "fallback";
    await armGuet([{ id: "p1", lat: 1, lng: 1 }], { hasGeolocConsent: true, spawter: { lat: 5.35, lng: -3.97 } });
    expect(startMock).not.toHaveBeenCalled();
  });

  it("no-op si consent géoloc absent", async () => {
    await armGuet([{ id: "p1", lat: 1, lng: 1 }], { hasGeolocConsent: false });
    expect(startMock).not.toHaveBeenCalled();
  });

  it("no-op si places vide", async () => {
    await armGuet([], { hasGeolocConsent: true, spawter: { lat: 5.35, lng: -3.97 } });
    expect(startMock).not.toHaveBeenCalled();
  });

  it("appelle startGeofencingAsync avec radius 150m", async () => {
    await armGuet([{ id: "p1", lat: 5.35, lng: -3.97 }], { hasGeolocConsent: true, spawter: { lat: 5.35, lng: -3.97 } });
    expect(startMock).toHaveBeenCalledTimes(1);
    const [, regions] = startMock.mock.calls[0] as [string, Array<{ radius: number }>];
    expect(regions[0]?.radius).toBe(150);
  });

  it("cap à MAX_ACTIVE_GEOFENCES (20) en gardant les plus proches", async () => {
    const places = Array.from({ length: 25 }, (_, i) => ({
      id: `p${i}`,
      lat: 5.35 + i * 0.01,
      lng: -3.97,
    }));
    await armGuet(places, {
      hasGeolocConsent: true,
      spawter: { lat: 5.35, lng: -3.97 },
    });
    const [, regions] = startMock.mock.calls[0] as [string, Array<unknown>];
    expect(regions).toHaveLength(MAX_ACTIVE_GEOFENCES);
  });

  it("ne crashe pas si permission foreground refusée", async () => {
    getFgMock.mockResolvedValueOnce({ status: "undetermined", canAskAgain: true });
    reqFgMock.mockResolvedValueOnce({ status: "denied" });
    await armGuet([{ id: "p1", lat: 1, lng: 1 }], { hasGeolocConsent: true, spawter: { lat: 5.35, lng: -3.97 } });
    expect(startMock).not.toHaveBeenCalled();
  });

  it.each(["foreground", "background", "flag", "consent"])("disarms existing regions when %s is revoked", async reason => {
    await armGuet(places, options);
    if (reason === "foreground") getFgMock.mockResolvedValue({ status: "denied", canAskAgain: false });
    if (reason === "background") getBgMock.mockResolvedValue({ status: "denied", canAskAgain: false });
    if (reason === "flag") mockEnabled = false;
    await armGuet(places, { ...options, hasGeolocConsent: reason !== "consent" });
    expect(await isGuetArmed()).toBe(false);
    expect(getArmedPlaceIds().size).toBe(0);
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(reqFgMock).not.toHaveBeenCalled();
    expect(reqBgMock).not.toHaveBeenCalled();
  });

  it("disarms previous regions after a permission API or native replacement failure", async () => {
    await armGuet(places, options);
    getBgMock.mockRejectedValueOnce(new Error("permission API unavailable"));
    await armGuet(places, options);
    expect(await isGuetArmed()).toBe(false);
    await armGuet(places, options);
    startMock.mockRejectedValueOnce(new Error("native replacement failed"));
    await armGuet(places, options);
    expect(await isGuetArmed()).toBe(false);
    expect(getArmedPlaceIds().size).toBe(0);
  });

  it("does not resurrect regions when a pending permission resolves after disarm", async () => {
    let resolvePermission!: (value: { status: string; canAskAgain: boolean }) => void;
    getBgMock.mockReturnValueOnce(new Promise(resolve => { resolvePermission = resolve; }));
    const started = armGuet(places, options);
    // Foreground permission has resolved; the background read is now pending.
    await Promise.resolve();
    await disarmGuet();
    resolvePermission({ status: "granted", canAskAgain: true });
    await started;
    expect(startMock).not.toHaveBeenCalled();
    expect(await isGuetArmed()).toBe(false);
  });

  it("finishes a pending native start before stopping it, so logout wins the race", async () => {
    let finishStart!: () => void;
    let didStart!: () => void;
    const nativeStarted = new Promise<void>(resolve => { didStart = resolve; });
    startMock.mockImplementationOnce(() => {
      didStart();
      return new Promise<void>(resolve => {
        finishStart = () => { nativeArmed = true; resolve(); };
      });
    });
    const started = armGuet(places, options);
    await nativeStarted;
    const stopped = disarmGuet();
    finishStart();
    await Promise.all([started, stopped]);
    expect(await isGuetArmed()).toBe(false);
    expect(getArmedPlaceIds().size).toBe(0);
    expect(stopMock).toHaveBeenCalled();
  });
});

describe("disarmGuet + isGuetArmed", () => {
  it("disarmGuet reset l'état armé", async () => {
    await armGuet([{ id: "p1", lat: 1, lng: 1 }], { hasGeolocConsent: true, spawter: { lat: 5.35, lng: -3.97 } });
    expect(getArmedPlaceIds().size).toBeGreaterThan(0);
    await disarmGuet();
    expect(getArmedPlaceIds().size).toBe(0);
  });

  it("isGuetArmed retourne false initialement", async () => {
    expect(await isGuetArmed()).toBe(false);
  });

  it("still attempts a native stop when the registration status cannot be read", async () => {
    await armGuet(places, options);
    hasStartedMock.mockRejectedValueOnce(new Error("native status unavailable"));
    await disarmGuet();
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(await isGuetArmed()).toBe(false);
  });
});
