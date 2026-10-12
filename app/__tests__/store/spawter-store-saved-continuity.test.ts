import AsyncStorage from "@react-native-async-storage/async-storage";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";
const mockArchetype = jest.fn(async (): Promise<{ quiz_archetype: string; pionnier_seq: number | null } | null> => null);
const mockServer = new Set<string>();
const mockRemote = jest.fn(async (): Promise<string[] | null> => [...mockServer]);
const mockSave = jest.fn(async (_owner: string, place: string) => { mockServer.add(place); });
const mockDelete = jest.fn(async (_owner: string, place: string) => { mockServer.delete(place); });
const mockGold = jest.fn(async (): Promise<unknown> => null);
const mockInternal = jest.fn(async (): Promise<boolean | null> => null);
const mockGetSession = jest.fn();
jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));
jest.mock("../../src/lib/data-source", () => ({
  __esModule: true,
  ...jest.requireActual("../../src/lib/data-source"),
  isSupabaseConfigured: false,
  fetchSpawterArchetype: () => mockArchetype(),
  listSavedPlaceIds: (...args: []) => mockRemote(...args),
  saveSavedPlace: (...args: [string, string]) => mockSave(...args),
  deleteSavedPlace: (...args: [string, string]) => mockDelete(...args),
  fetchGoldEntitlement: () => mockGold(),
  fetchSpawterInternal: () => mockInternal(),
}));
jest.mock("../../src/lib/analytics", () => ({ track: jest.fn() }));
import { useSpawterStore } from "../../src/store/spawter-store";
import { GOLD_STORAGE_KEY, getGoldEntitlementState, isInternalAccount } from "../../src/lib/spawter-gold";
const tick = async () => { for (let i = 0; i < 3; i++) await new Promise<void>((r) => setTimeout(r, 0)); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
async function boot() {
  await AsyncStorage.setItem("spawt:spawter", JSON.stringify(SAMPLE_SPAWTER));
  await useSpawterStore.getState().hydrate();
  await tick();
}
beforeEach(async () => {
  useSpawterStore.getState().reset();
  await tick();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockServer.clear();
  jest.requireMock("../../src/lib/data-source").isSupabaseConfigured = false;
  mockArchetype.mockResolvedValue(null);
  mockRemote.mockImplementation(async () => [...mockServer]);
  mockSave.mockImplementation(async (_owner, place) => { mockServer.add(place); });
  mockDelete.mockImplementation(async (_owner, place) => { mockServer.delete(place); });
  mockGold.mockResolvedValue(null);
  mockInternal.mockResolvedValue(null);
  mockGetSession.mockReset().mockResolvedValue({ data: { session: { user: { id: SAMPLE_SPAWTER.id } } }, error: null });
});
it("conserve les deux favoris simultanés, y compris après relance", async () => {
  await Promise.all([useSpawterStore.getState().toggleSaved("spot-a"), useSpawterStore.getState().toggleSaved("spot-b")]);
  expect([...useSpawterStore.getState().savedPlaceIds].sort()).toEqual(["spot-a", "spot-b"]);
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().savedPlaceIds.size).toBe(2);
});
it("ne recrée pas un ancien favori absent du serveur", async () => {
  await AsyncStorage.setItem("spawt:saved_places", JSON.stringify(["ancien-favori"]));
  await boot();
  expect(mockSave).not.toHaveBeenCalled();
  expect(useSpawterStore.getState().savedPlaceIds.has("ancien-favori")).toBe(false);
});
it("ignore une réponse de favoris après la sortie du compte", async () => {
  const pending = deferred<string[]>();
  mockRemote.mockReturnValueOnce(pending.promise);
  await boot();
  useSpawterStore.getState().reset();
  await tick();
  pending.resolve(["favori-compte-a"]);
  await tick();
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(useSpawterStore.getState().savedPlaceIds.size).toBe(0);
  expect(await AsyncStorage.getItem("spawt:saved_places")).toBeNull();
});
it("reprend un ajout hors ligne après relance sans le perdre", async () => {
  await boot();
  mockRemote.mockResolvedValue(null);
  await useSpawterStore.getState().toggleSaved("hors-ligne");
  await useSpawterStore.getState().hydrate();
  await tick();
  expect(useSpawterStore.getState().savedPlaceIds.has("hors-ligne")).toBe(true);
  expect(mockSave).not.toHaveBeenCalled();
  mockRemote.mockImplementation(async () => [...mockServer]);
  await useSpawterStore.getState().refreshSaved();
  expect(mockServer.has("hors-ligne")).toBe(true);
});
it("reprend une suppression refusée, après relance, sans ressusciter le favori", async () => {
  mockServer.add("a-retirer");
  await boot();
  mockDelete.mockRejectedValue(new Error("offline"));
  await useSpawterStore.getState().toggleSaved("a-retirer");
  await tick();
  await useSpawterStore.getState().hydrate();
  await tick();
  expect(useSpawterStore.getState().savedPlaceIds.has("a-retirer")).toBe(false);
  expect(mockServer.has("a-retirer")).toBe(true);
  mockDelete.mockImplementation(async (_owner, place) => { mockServer.delete(place); });
  await useSpawterStore.getState().refreshSaved();
  expect(mockServer.has("a-retirer")).toBe(false);
});
it("une réponse ancienne n'acquitte pas le choix contraire enregistré pendant l'envoi", async () => {
  await boot();
  const started = deferred<void>(); const pending = deferred<void>();
  mockSave.mockImplementationOnce(async (_owner, place) => { started.resolve(); await pending.promise; mockServer.add(place); });
  await useSpawterStore.getState().toggleSaved("a");
  await started.promise;
  await useSpawterStore.getState().toggleSaved("a");
  expect(useSpawterStore.getState().savedPlaceIds.has("a")).toBe(false);
  pending.resolve();
  await useSpawterStore.getState().refreshSaved();
  expect(mockServer.has("a")).toBe(false);
  expect(useSpawterStore.getState().savedPlaceIds.has("a")).toBe(false);
});
it("un envoi lent ne bloque pas un autre favori local", async () => {
  await boot();
  const started = deferred<void>(); const pending = deferred<void>();
  mockSave.mockImplementationOnce(async (_owner, place) => { started.resolve(); await pending.promise; mockServer.add(place); });
  await useSpawterStore.getState().toggleSaved("a");
  await started.promise;
  await useSpawterStore.getState().toggleSaved("b");
  expect(useSpawterStore.getState().savedPlaceIds.has("b")).toBe(true);
  pending.resolve();
  await useSpawterStore.getState().refreshSaved();
  expect([...mockServer].sort()).toEqual(["a", "b"]);
});
it("une erreur disque n'est pas un faux succès et ne modifie pas le choix", async () => {
  await boot();
  const before = await AsyncStorage.getItem("spawt:saved_places");
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("quota"));
  await expect(useSpawterStore.getState().toggleSaved("a")).rejects.toThrow("quota");
  expect(useSpawterStore.getState().savedPlaceIds.has("a")).toBe(false);
  expect(await AsyncStorage.getItem("spawt:saved_places")).toBe(before);
  expect(mockSave).not.toHaveBeenCalled();
});
it("un cache illisible reste intact et n'est pas écrasé par un favori", async () => {
  await AsyncStorage.setItem("spawt:saved_places", "{cassé");
  await expect(useSpawterStore.getState().toggleSaved("a")).rejects.toThrow();
  expect(await AsyncStorage.getItem("spawt:saved_places")).toBe("{cassé");
});
it("le cache identifié de A n'est pas adopté par B", async () => {
  mockRemote.mockResolvedValue(null);
  await boot();
  await useSpawterStore.getState().toggleSaved("secret-a");
  await AsyncStorage.setItem("spawt:spawter", JSON.stringify({ ...SAMPLE_SPAWTER, id: "compte-b" }));
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().savedPlaceIds.size).toBe(0);
  await expect(useSpawterStore.getState().toggleSaved("b")).rejects.toThrow("saved_places_owner_mismatch");
  expect(mockSave).not.toHaveBeenCalled();
});
it("la déconnexion ne restaure pas le compte et ses avis à la relance", async () => {
  await boot();
  await AsyncStorage.setItem("spawt:spawts", JSON.stringify([{ id: "avis-a" }]));
  useSpawterStore.getState().reset();
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(useSpawterStore.getState().spawts).toEqual([]);
});
it("un Gold tardif après déconnexion ne rend pas son droit au prochain compte", async () => {
  await boot();
  const pending = deferred<unknown>(); mockGold.mockReturnValueOnce(pending.promise);
  const refresh = useSpawterStore.getState().refreshGold();
  await tick();
  useSpawterStore.getState().reset();
  await tick();
  pending.resolve({ active: true, expires_at: "2099-01-01" });
  await refresh;
  expect(useSpawterStore.getState().gold).toBeNull();
  expect(getGoldEntitlementState()).toBeNull();
  expect(await AsyncStorage.getItem(GOLD_STORAGE_KEY)).toBeNull();
});
it("un statut interne tardif après déconnexion ne déverrouille pas le compte suivant", async () => {
  const pending = deferred<boolean>(); mockInternal.mockReturnValueOnce(pending.promise);
  await boot();
  useSpawterStore.getState().reset();
  await tick(); pending.resolve(true); await tick();
  expect(isInternalAccount()).toBe(false);
  expect(await AsyncStorage.getItem("spawt:spawter")).toBeNull();
});

it("une lecture de favoris en panne reste visible sans bloquer le reste du compte", async () => {
  await AsyncStorage.setItem("spawt:saved_places", "{cassé");
  await boot();
  expect(useSpawterStore.getState().hydrating).toBe(false);
  expect(useSpawterStore.getState().spawter?.id).toBe(SAMPLE_SPAWTER.id);
  expect(useSpawterStore.getState().savedUnavailable).toBe(true);
  expect(await AsyncStorage.getItem("spawt:saved_places")).toBe("{cassé");
});

it("un archétype reçu après déconnexion ne restaure pas l'identité précédente", async () => {
  jest.requireMock("../../src/lib/data-source").isSupabaseConfigured = true;
  const pending = deferred<{ quiz_archetype: string; pionnier_seq: number | null }>();
  mockArchetype.mockReturnValueOnce(pending.promise);
  await AsyncStorage.setItem("spawt:spawter", JSON.stringify({ ...SAMPLE_SPAWTER, quiz_archetype: null }));
  await useSpawterStore.getState().hydrate();
  await tick();
  expect(jest.requireMock("../../src/lib/data-source").isSupabaseConfigured).toBe(true);
  expect(mockGetSession).toHaveBeenCalledTimes(1);
  expect(useSpawterStore.getState().spawter?.quiz_archetype).toBeNull();
  expect(mockArchetype).toHaveBeenCalledTimes(1);
  useSpawterStore.getState().reset();
  await tick(); pending.resolve({ quiz_archetype: "oeil", pionnier_seq: 1 }); await tick();
  expect(useSpawterStore.getState().spawter).toBeNull();
  expect(await AsyncStorage.getItem("spawt:spawter")).toBeNull();
});
it("une ancienne revalidation Gold ne libère pas celle du compte suivant", async () => {
  await boot();
  const a = deferred<unknown>(); const b = deferred<unknown>();
  mockGold.mockReturnValueOnce(a.promise);
  const first = useSpawterStore.getState().refreshGold(); await tick();
  useSpawterStore.getState().reset(); await tick();
  useSpawterStore.setState({ spawter: { ...SAMPLE_SPAWTER, id: "compte-b" } });
  mockGold.mockReturnValueOnce(b.promise);
  const second = useSpawterStore.getState().refreshGold(); await tick();
  const calls = mockGold.mock.calls.length;
  a.resolve({ active: true }); await first;
  const third = useSpawterStore.getState().refreshGold(); await tick();
  expect(mockGold).toHaveBeenCalledTimes(calls);
  b.resolve({ active: false }); await Promise.all([second, third]);
  expect(useSpawterStore.getState().gold?.active).toBe(false);
});
it("une hydratation commencée avant déconnexion n'annule pas la purge", async () => {
  const pending = deferred<string | null>();
  jest.spyOn(AsyncStorage, "getItem").mockImplementationOnce(() => pending.promise);
  const hydration = useSpawterStore.getState().hydrate(); await tick();
  useSpawterStore.getState().reset(); await tick();
  pending.resolve(JSON.stringify(SAMPLE_SPAWTER)); await hydration;
  expect(useSpawterStore.getState().spawter).toBeNull();
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().spawter).toBeNull();
});
it("un acquittement local en panne reste rejouable après confirmation du serveur", async () => {
  await boot(); mockRemote.mockResolvedValue(null);
  await useSpawterStore.getState().toggleSaved("a"); await tick();
  mockRemote.mockImplementation(async () => [...mockServer]);
  mockSave.mockImplementationOnce(async (_owner, place) => {
    mockServer.add(place);
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("acquittement disque"));
  });
  await expect(useSpawterStore.getState().refreshSaved()).rejects.toThrow("acquittement disque");
  expect(mockServer.has("a")).toBe(true);
  await useSpawterStore.getState().hydrate(); await tick();
  expect(useSpawterStore.getState().savedPlaceIds.has("a")).toBe(true);
  expect(mockServer.size).toBe(1);
});
