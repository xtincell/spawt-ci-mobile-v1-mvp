// Story 4.1 — Tests unit `geofence.ts`.
// Vise AC #8 (couverture). Mocks expo-location + data-source + feature-flags.

jest.mock("expo-location", () => ({
  __esModule: true,
  GeofencingEventType: { Enter: 1, Exit: 2 },
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

jest.mock("../../../store/feature-flags", () => ({
  useFeatureFlagsStore: {
    getState: () => ({ flags: { "guet-geofence": true } }),
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

beforeEach(() => {
  startMock.mockClear();
  stopMock.mockClear();
  reqFgMock.mockClear();
  reqFgMock.mockResolvedValue({ status: "granted" });
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
    await armGuet([{ id: "p1", lat: 1, lng: 1 }], { hasGeolocConsent: true });
    expect(startMock).not.toHaveBeenCalled();
  });

  it("no-op si consent géoloc absent", async () => {
    await armGuet([{ id: "p1", lat: 1, lng: 1 }], { hasGeolocConsent: false });
    expect(startMock).not.toHaveBeenCalled();
  });

  it("no-op si places vide", async () => {
    await armGuet([], { hasGeolocConsent: true });
    expect(startMock).not.toHaveBeenCalled();
  });

  it("appelle startGeofencingAsync avec radius 10m", async () => {
    await armGuet([{ id: "p1", lat: 5.35, lng: -3.97 }], { hasGeolocConsent: true });
    expect(startMock).toHaveBeenCalledTimes(1);
    const [, regions] = startMock.mock.calls[0] as [string, Array<{ radius: number }>];
    expect(regions[0]?.radius).toBe(10);
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
    reqFgMock.mockResolvedValueOnce({ status: "denied" });
    await armGuet([{ id: "p1", lat: 1, lng: 1 }], { hasGeolocConsent: true });
    expect(startMock).not.toHaveBeenCalled();
  });
});

describe("disarmGuet + isGuetArmed", () => {
  it("disarmGuet reset l'état armé", async () => {
    await armGuet([{ id: "p1", lat: 1, lng: 1 }], { hasGeolocConsent: true });
    expect(getArmedPlaceIds().size).toBeGreaterThan(0);
    await disarmGuet();
    expect(getArmedPlaceIds().size).toBe(0);
  });

  it("isGuetArmed retourne false initialement", async () => {
    expect(await isGuetArmed()).toBe(false);
  });
});
