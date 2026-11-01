import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import * as Location from "expo-location";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));
const mockListFlags = jest.fn();
jest.mock("../../data-source", () => ({
  dataSourceMode: "supabase",
  listFeatureFlags: (...args: unknown[]) => mockListFlags(...args),
}));
jest.mock("../../../store/spawter-store", () => ({
  useSpawterStore: require("zustand/vanilla").createStore(() => ({
    spawter: null, savedPlaceIds: new Set(), spawts: [],
  })),
}));
const mockSession = jest.fn();
const mockReadPlaces = jest.fn();
const mockFrom = jest.fn((_table: string) => ({
  select: () => ({ abortSignal: () => mockReadPlaces() }),
}));
jest.mock("../../supabase", () => ({ supabase: {
  auth: { getSession: (...args: unknown[]) => mockSession(...args) },
  from: (table: string) => mockFrom(table),
} }));
const mockOutings = jest.fn();
jest.mock("../../outings", () => ({ localOutings: (...args: unknown[]) => mockOutings(...args) }));
jest.mock("../guet-task", () => ({ registerGeofenceCallback: jest.fn(), setPlaceNameLookup: jest.fn() }));
const mockNotificationPermission = jest.fn();
jest.mock("../guet-permissions", () => ({
  ensureNotifPermissionPostOTP: (...args: unknown[]) => mockNotificationPermission(...args),
}));
const mockCancelNotifications = jest.fn();
const mockStopResponses = jest.fn();
jest.mock("../guet-notifications", () => ({
  cancelAllGuetNotifications: (...args: unknown[]) => mockCancelNotifications(...args),
  registerNotificationResponseHandler: jest.fn(() => mockStopResponses),
}));
let mockArmed = false;
const mockArm = jest.fn();
const mockDisarm = jest.fn();
jest.mock("../geofence", () => ({
  armGuet: (...args: unknown[]) => mockArm(...args),
  disarmGuet: (...args: unknown[]) => mockDisarm(...args),
  isGuetArmed: async () => mockArmed,
}));

import { useSpawterStore } from "../../../store/spawter-store";
import { useFeatureFlagsStore } from "../../../store/feature-flags";
import { useGuetActive } from "../../../store/guet-active";
import { GUET_CONTEXT_KEY, serialGuet } from "../guet-nearby";
import { bootGuet, rearmGuet, setGuetOptOut, shutdownGuet, _resetOrchestratorForTest } from "../guet-orchestrator";

const granted = { status: "granted", canAskAgain: true };
const denied = { status: "denied", canAskAgain: false };
const place = { id: "p", name: "Lieu", lat: 5.35, lng: -3.97 };
const activeListeners = new Set<(state: AppStateStatus) => void>();
let enabled = true;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function setAccount(id: string | null) {
  useSpawterStore.setState({
    spawter: id ? { id, geoloc_consent_at: "2026-10-01T10:00:00Z" } as never : null,
    savedPlaceIds: new Set(), spawts: [],
  });
  mockSession.mockResolvedValue({ data: { session: id ? { user: { id } } : null }, error: null });
}
async function settle() { await serialGuet(async () => undefined); }
async function foreground() {
  for (const listener of [...activeListeners]) listener("active");
  await settle();
}
async function context() {
  const raw = await AsyncStorage.getItem(GUET_CONTEXT_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(async () => {
  _resetOrchestratorForTest();
  await settle();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useFeatureFlagsStore.getState().reset();
  useGuetActive.getState().exit();
  activeListeners.clear();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    activeListeners.add(listener);
    return { remove: () => { activeListeners.delete(listener); } };
  });
  enabled = true; mockArmed = false;
  mockListFlags.mockImplementation(async () => [{ flag_code: "guet-proximity-v2", enabled, scope: "prod", spawter_id: null }]);
  mockNotificationPermission.mockResolvedValue("granted");
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
  (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
  (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: 5.35, longitude: -3.97 } });
  mockReadPlaces.mockResolvedValue({ data: [place], error: null });
  mockOutings.mockResolvedValue({ snapshot: { dishes: [] } });
  mockArm.mockImplementation(async () => { mockArmed = true; });
  mockDisarm.mockImplementation(async () => { mockArmed = false; });
  mockCancelNotifications.mockResolvedValue(undefined);
  setAccount("a");
});

afterEach(async () => {
  await shutdownGuet();
  jest.restoreAllMocks();
});

it("activates when the backend flag arrives after a disabled boot, without an app restart", async () => {
  enabled = false;
  await bootGuet();
  expect(mockArm).not.toHaveBeenCalled();
  enabled = true;
  await useFeatureFlagsStore.getState().hydrate("a");
  await settle();
  expect(mockArm).toHaveBeenCalledTimes(1);
  expect(await context()).toMatchObject({ owner: "a", places: [{ id: "p", visited: false, saved: false }] });
  expect(mockFrom.mock.calls.map(call => call[0])).toEqual(["public_guet_places"]);
  expect(useSpawterStore.getState().spawts).toEqual([]);
});

it("stops immediately on flag disable and can resume inside the five-minute refresh window", async () => {
  await bootGuet();
  useGuetActive.getState().enter({ place_id: "p", place_name: "Lieu" });
  mockCancelNotifications.mockClear();
  enabled = false;
  await useFeatureFlagsStore.getState().hydrate("a");
  await settle();
  expect(mockArmed).toBe(false);
  expect(await context()).toBeNull();
  expect(useGuetActive.getState().active).toBeNull();
  expect(mockCancelNotifications).toHaveBeenCalled();
  enabled = true;
  await useFeatureFlagsStore.getState().hydrate("a");
  await settle();
  expect(mockArm).toHaveBeenCalledTimes(2);
  expect(await context()).toMatchObject({ owner: "a" });
});

it.each(["notifications", "foreground", "background"])("checks a revoked %s permission before the refresh throttle and resumes after restoration", async kind => {
  await bootGuet();
  if (kind === "notifications") mockNotificationPermission.mockResolvedValue("denied");
  if (kind === "foreground") (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue(denied);
  if (kind === "background") (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue(denied);
  mockCancelNotifications.mockClear();
  await foreground();
  expect(mockArmed).toBe(false);
  expect(await context()).toBeNull();
  expect(mockCancelNotifications).toHaveBeenCalled();
  expect(mockReadPlaces).toHaveBeenCalledTimes(1);
  mockNotificationPermission.mockResolvedValue("granted");
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
  (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue(granted);
  await foreground();
  expect(mockArm).toHaveBeenCalledTimes(2);
});

it("recovers on foreground after an initially denied notification permission", async () => {
  mockNotificationPermission.mockResolvedValue("denied");
  await bootGuet();
  expect(mockArm).not.toHaveBeenCalled();
  expect(mockReadPlaces).not.toHaveBeenCalled();
  mockNotificationPermission.mockResolvedValue("granted");
  await foreground();
  expect(mockArm).toHaveBeenCalledTimes(1);
});

it("disarms after a catalogue failure and retries on foreground", async () => {
  await bootGuet();
  mockReadPlaces.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
  await rearmGuet({ force: true });
  expect(mockArmed).toBe(false);
  expect(await context()).toBeNull();
  await foreground();
  expect(mockArm).toHaveBeenCalledTimes(2);
});

it("restores a registration lost by the OS without waiting for the catalogue throttle", async () => {
  await bootGuet();
  mockArmed = false;
  await foreground();
  expect(mockArm).toHaveBeenCalledTimes(2);
  expect(mockReadPlaces).toHaveBeenCalledTimes(2);
});

it("does not install duplicate listeners or arm twice during overlapping boots", async () => {
  await Promise.all([bootGuet(), bootGuet()]);
  expect(activeListeners.size).toBe(1);
  expect(mockArm).toHaveBeenCalledTimes(1);
  await foreground();
  expect(mockArm).toHaveBeenCalledTimes(1);
});

it("ignores account A's late catalogue response and arms only account B's context", async () => {
  const pending = deferred<{ data: typeof place[]; error: null }>();
  const started = deferred<void>();
  mockReadPlaces.mockImplementationOnce(() => { started.resolve(); return pending.promise; });
  const firstBoot = bootGuet();
  await started.promise;
  setAccount("b");
  mockReadPlaces.mockResolvedValue({ data: [{ ...place, id: "b-place" }], error: null });
  const secondBoot = bootGuet();
  pending.resolve({ data: [{ ...place, id: "a-place" }], error: null });
  await Promise.all([firstBoot, secondBoot]);
  await settle();
  expect(mockArm).toHaveBeenCalledTimes(1);
  expect(mockArm.mock.calls[0][0]).toEqual([expect.objectContaining({ id: "b-place" })]);
  expect(await context()).toMatchObject({ owner: "b", places: [{ id: "b-place" }] });
  expect(mockOutings).toHaveBeenCalledWith("b");
  expect(mockOutings).not.toHaveBeenCalledWith("a");
  expect(activeListeners.size).toBe(1);
});

it("clears account context and pending notifications at logout, including native cleanup if storage fails", async () => {
  await bootGuet();
  mockCancelNotifications.mockClear();
  const remove = AsyncStorage.removeItem as jest.Mock;
  remove.mockRejectedValueOnce(new Error("storage unavailable"));
  setAccount(null);
  await settle();
  expect(mockArmed).toBe(false);
  expect(await context()).toBeNull();
  expect(mockCancelNotifications).toHaveBeenCalled();
  expect(activeListeners.size).toBe(0);
  expect(mockStopResponses).toHaveBeenCalled();
});

it("does not arm a profile whose authenticated session belongs to another account", async () => {
  mockSession.mockResolvedValue({ data: { session: { user: { id: "b" } } }, error: null });
  await bootGuet();
  expect(mockArm).not.toHaveBeenCalled();
  expect(mockReadPlaces).not.toHaveBeenCalled();
  expect(await context()).toBeNull();
});

it("revokes native work on logout while a GPS request is still pending and ignores its late fix", async () => {
  await bootGuet();
  const pending = deferred<null>();
  const started = deferred<void>();
  (Location.getLastKnownPositionAsync as jest.Mock).mockImplementationOnce(() => {
    started.resolve(); return pending.promise;
  });
  const rearming = rearmGuet({ force: true });
  await started.promise;
  mockCancelNotifications.mockClear();
  setAccount(null);
  // These must happen before the pending GPS request is released.
  expect(mockArmed).toBe(false);
  expect(mockCancelNotifications).toHaveBeenCalled();
  expect(await context()).toBeNull();
  pending.resolve(null);
  await rearming;
  await settle();
  expect(mockArm).toHaveBeenCalledTimes(1);
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(await context()).toBeNull();
});

it("keeps an opt-out across flag refreshes, then resumes through the existing setting", async () => {
  await bootGuet();
  await setGuetOptOut(true);
  enabled = false;
  await useFeatureFlagsStore.getState().hydrate("a");
  enabled = true;
  await useFeatureFlagsStore.getState().hydrate("a");
  await settle();
  expect(mockArmed).toBe(false);
  expect(await context()).toBeNull();
  expect(mockArm).toHaveBeenCalledTimes(1);
  await setGuetOptOut(false);
  expect(mockArm).toHaveBeenCalledTimes(2);
  expect(await context()).toMatchObject({ owner: "a" });
});
