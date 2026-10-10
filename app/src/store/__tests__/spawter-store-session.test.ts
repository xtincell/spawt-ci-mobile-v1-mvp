import AsyncStorage from "@react-native-async-storage/async-storage";
import { SAMPLE_SPAWTER, EMPTY_PALAIS } from "../../data/seed/sample-spawter";
const mockSessionCheck = jest.fn();
jest.mock("../../lib/cached-session", () => ({ canPublishCachedAccount: (...args: unknown[]) => mockSessionCheck(...args) }));
jest.mock("../../lib/data-source", () => ({
  ...jest.requireActual("../../lib/data-source"),
  isSupabaseConfigured: true,
  fetchGoldEntitlement: () => Promise.resolve(null),
  fetchSpawterInternal: () => Promise.resolve(false),
  fetchSpawterArchetype: () => Promise.resolve(null),
}));
jest.mock("../../lib/analytics", () => ({ track: jest.fn() }));
import { useSpawterStore } from "../spawter-store";
import { useFeatureFlagsStore } from "../feature-flags";
import { useProgressionStore } from "../progression-store";

beforeEach(async () => {
  useSpawterStore.getState().reset();
  await useSpawterStore.getState().hydrate();
  await AsyncStorage.clear();
  await AsyncStorage.setItem("spawt:spawter", JSON.stringify(SAMPLE_SPAWTER));
  await AsyncStorage.setItem("spawt:palais", JSON.stringify(EMPTY_PALAIS));
  mockSessionCheck.mockReset();
  useSpawterStore.getState().observeAuthSession(SAMPLE_SPAWTER.id);
});

it("un cache sans session correspondante n'apparaît pas et reste sur disque", async () => {
  mockSessionCheck.mockResolvedValue(false);
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(useSpawterStore.getState().hydrating).toBe(false);
  expect(JSON.parse((await AsyncStorage.getItem("spawt:spawter"))!)).toEqual(SAMPLE_SPAWTER);
});

it("une panne auth laisse le cache intact et remonte vers la reprise du démarrage", async () => {
  mockSessionCheck.mockRejectedValue(new Error("ACCOUNT_SESSION_UNAVAILABLE"));
  await expect(useSpawterStore.getState().hydrate()).rejects.toThrow("ACCOUNT_SESSION_UNAVAILABLE");
  expect(JSON.parse((await AsyncStorage.getItem("spawt:spawter"))!)).toEqual(SAMPLE_SPAWTER);
});

it("la suspension SDK retire compte, flags et progression sans effacer le disque", async () => {
  useSpawterStore.setState({ spawter: SAMPLE_SPAWTER, palais: EMPTY_PALAIS });
  useFeatureFlagsStore.getState().setLocalOverride("private", true);
  useProgressionStore.setState({ spawterId: SAMPLE_SPAWTER.id, pawsBalance: 500 });
  useSpawterStore.getState().suspendSession();
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(useFeatureFlagsStore.getState().flags).toEqual({});
  expect(useProgressionStore.getState().pawsBalance).toBeNull();
  expect(await AsyncStorage.getItem("spawt:spawter")).not.toBeNull();
});

it("une suspension pendant la vérification empêche une ancienne hydratation de republier A", async () => {
  let resolve!: (allowed: boolean) => void;
  mockSessionCheck.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const hydrate = useSpawterStore.getState().hydrate();
  while (!resolve) await Promise.resolve();
  useSpawterStore.getState().suspendSession();
  resolve(true);
  await hydrate;
  expect(useSpawterStore.getState().spawter).toBeNull();
});

it("un événement SIGNED_IN du même compte pendant le démarrage ne masque pas le compte", async () => {
  let resolve!: (allowed: boolean) => void;
  mockSessionCheck.mockImplementation(() => new Promise((r) => { resolve = r; }));
  useSpawterStore.setState({ hydrating: true });
  const hydrate = useSpawterStore.getState().hydrate();
  while (!resolve) await Promise.resolve();
  useSpawterStore.getState().observeAuthSession(SAMPLE_SPAWTER.id);
  expect(useSpawterStore.getState().hydrating).toBe(true);
  resolve(true);
  await hydrate;
  expect(useSpawterStore.getState().spawter?.id).toBe(SAMPLE_SPAWTER.id);
  expect(useSpawterStore.getState().hydrating).toBe(false);
});

it("un autre compte SDK reçu pendant la lecture invalide l'ancien cache", async () => {
  let resolve!: (allowed: boolean) => void;
  mockSessionCheck.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const hydrate = useSpawterStore.getState().hydrate();
  while (!resolve) await Promise.resolve();
  useSpawterStore.getState().observeAuthSession("compte-B");
  resolve(true);
  await hydrate;
  expect(useSpawterStore.getState().spawter).toBeNull();
});
