import AsyncStorage from "@react-native-async-storage/async-storage";
import { EMPTY_PALAIS, SAMPLE_SPAWTER } from "../../data/seed/sample-spawter";
import { buildManualSpawt } from "../../lib/guet/guet-spawt-actions";
import { saveReviewDraft, saveReviewPlaceSignals } from "../../lib/review-drafts";
import { flush, inspect, pendingPalais, setSyncBackend, _resetForTest } from "../../lib/offline-queue";
import type { UserPalais } from "../../types/palais";
import type { SpawtCheckin } from "../../types/spawt";

const mockPlace = jest.fn();
const mockAccount = jest.fn();
const mockHistory = jest.fn();
let mockOwner: string | null = SAMPLE_SPAWTER.id;
jest.mock("../../lib/data-source", () => ({
  ...jest.requireActual("../../lib/data-source"), isSupabaseConfigured: true,
  getPlace: (...args: unknown[]) => mockPlace(...args),
  saveSpawter: jest.fn(async () => undefined), savePalais: jest.fn(async () => undefined),
  fetchGoldEntitlement: async () => null, fetchSpawterInternal: async () => false, fetchSpawterArchetype: async () => null,
}));
jest.mock("../../lib/account-recovery", () => ({
  ...jest.requireActual("../../lib/account-recovery"),
  readAuthenticatedAccount: (...args: unknown[]) => mockAccount(...args),
  requireAccountSession: async () => mockOwner,
}));
jest.mock("../../lib/account-history", () => ({ readAccountHistory: (...args: unknown[]) => mockHistory(...args) }));
jest.mock("../../lib/cached-session", () => ({ canPublishCachedAccount: async (id: string) => id === mockOwner }));
jest.mock("../../lib/place-adn-update", () => ({ recomputeAndPersistPlaceAdn: jest.fn(async () => undefined) }));
jest.mock("../../lib/archetype-mue", () => ({
  ...jest.requireActual("../../lib/archetype-mue"), evaluateArchetypeTransition: () => ({ type: "none", streak: null }),
}));
jest.mock("../../lib/analytics", () => ({ track: jest.fn() }));
import { useSpawterStore } from "../spawter-store";

const owner = SAMPLE_SPAWTER.id;
const initial = { ...EMPTY_PALAIS, spawter_id: owner };
const profile = { ...SAMPLE_SPAWTER, unique_spots: 0, total_spawts: 1 };
let row: SpawtCheckin;
let online: boolean;
let serverPalais: UserPalais;
let remoteRows: SpawtCheckin[];
const patch = { note_etoiles: 5 as const, tags: ["a_refaire" as const], texte_avis: "Bien reçu", photos: [] };

beforeEach(async () => {
  useSpawterStore.getState().reset(); await useSpawterStore.getState().hydrate();
  await AsyncStorage.clear(); await _resetForTest();
  mockOwner = owner; online = false; serverPalais = { ...initial }; remoteRows = [];
  row = { ...buildManualSpawt(owner, "place-a", 5.3, -4.0), id: "review-a" };
  useSpawterStore.setState({ spawter: { ...profile }, palais: { ...initial }, spawts: [row], hydrating: false });
  mockPlace.mockReset(); mockPlace.mockResolvedValue({ signals: ["institution"] });
  mockAccount.mockImplementation(async () => ({ kind: "existing", owner, spawter: profile, palais: { ...serverPalais } }));
  mockHistory.mockImplementation(async () => ({ spawts: [...remoteRows], collectionTitres: [] }));
  setSyncBackend({
    currentOwner: async () => mockOwner,
    upsertSpawt: async received => { if (!online) return false; remoteRows = [received]; return true; },
    upsertPalais: async received => { if (!online) return false; serverPalais = { ...received }; return true; },
    upsertSpawter: async () => online, updateSpawt: async () => online,
  });
});

it("l'avis reçoit les signaux du vrai lieu une seule fois même en double soumission", async () => {
  await Promise.all([
    useSpawterStore.getState().attachReviewToSpawt(row.id, patch),
    useSpawterStore.getState().attachReviewToSpawt(row.id, patch),
  ]);
  expect(mockPlace).toHaveBeenCalledTimes(1);
  // Le tag a_refaire ne touche pas Racines. Ce -0.04 provient du lieu institution.
  expect(useSpawterStore.getState().palais?.axe_racines_horizons).toBeCloseTo(initial.axe_racines_horizons - 0.04);
  expect(useSpawterStore.getState().spawts).toHaveLength(1);
  expect((await inspect()).map(e => e.kind)).toEqual(["spawt_insert", "palais_upsert"]);
});

it("le contexte déjà sauvegardé permet un avis hors réseau sans faux fallback", async () => {
  await saveReviewPlaceSignals(owner, row.id, ["institution"]);
  await saveReviewDraft(owner, row.id, {
    note_cuisine: 5, note_cadre: 5, note_service: 5, tags: patch.tags, text: patch.texte_avis, photoUris: [],
  });
  mockPlace.mockRejectedValue(new Error("offline"));
  await expect(useSpawterStore.getState().attachReviewToSpawt(row.id, patch)).resolves.toEqual({ persisted: "queued" });
  expect(mockPlace).not.toHaveBeenCalled();
  expect((await pendingPalais(owner))?.axe_racines_horizons).toBeCloseTo(initial.axe_racines_horizons - 0.04);
});

it("un arrêt après la file mais avant les caches restaure ensemble avis et Palais sans réapprendre", async () => {
  await saveReviewPlaceSignals(owner, row.id, ["institution"]);
  await useSpawterStore.getState().attachReviewToSpawt(row.id, patch);
  const expected = useSpawterStore.getState().palais;
  await AsyncStorage.multiSet([
    ["spawt:spawter", JSON.stringify(profile)],
    ["spawt:palais", JSON.stringify(initial)],
    ["spawt:spawts", JSON.stringify([row])],
  ]);
  useSpawterStore.getState().suspendSession();
  await useSpawterStore.getState().hydrate();
  expect(useSpawterStore.getState().palais).toEqual(expected);
  expect(useSpawterStore.getState().spawts[0]?.note_etoiles).toBe(5);
  await useSpawterStore.getState().attachReviewToSpawt(row.id, patch);
  expect(useSpawterStore.getState().palais).toEqual(expected);
});

it("panne puis reprise et reconnexion restaurent exactement le Palais appris", async () => {
  await saveReviewPlaceSignals(owner, row.id, ["institution"]);
  await useSpawterStore.getState().attachReviewToSpawt(row.id, patch);
  const expected = useSpawterStore.getState().palais;
  online = true; await flush(new Date(Date.now() + 120_000));
  expect(await inspect()).toEqual([]);
  useSpawterStore.getState().suspendSession();
  await useSpawterStore.getState().recoverAuthenticatedAccount(owner);
  expect(useSpawterStore.getState().palais).toEqual(expected);
  expect(useSpawterStore.getState().spawts).toHaveLength(1);
  expect(useSpawterStore.getState().spawts[0]?.note_etoiles).toBe(5);
});

it("une reconnexion avant reprise des écritures garde le snapshot durable de ce compte", async () => {
  await saveReviewPlaceSignals(owner, row.id, ["institution"]);
  await useSpawterStore.getState().attachReviewToSpawt(row.id, patch);
  const expected = useSpawterStore.getState().palais;
  useSpawterStore.getState().suspendSession();
  await useSpawterStore.getState().recoverAuthenticatedAccount(owner);
  expect(useSpawterStore.getState().palais).toEqual(expected);
  expect(useSpawterStore.getState().spawts[0]?.note_etoiles).toBe(5);
});

it("une lecture tardive du lieu ne peut écrire dans le compte suivant", async () => {
  let finish!: (value: { signals: string[] }) => void;
  mockPlace.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const writing = useSpawterStore.getState().attachReviewToSpawt(row.id, patch);
  while (!finish) await Promise.resolve();
  useSpawterStore.getState().suspendSession(); mockOwner = "b";
  useSpawterStore.setState({ spawter: { ...profile, id: "b" }, palais: { ...initial, spawter_id: "b" }, spawts: [] });
  finish({ signals: ["institution"] });
  await expect(writing).rejects.toThrow("ACCOUNT_SESSION_CHANGED");
  expect(useSpawterStore.getState().palais?.axe_racines_horizons).toBe(initial.axe_racines_horizons);
  expect(await inspect()).toEqual([]);
});

it("la présence serveur réconcilie une visite existante sans ajouter ni compter les annulées", async () => {
  const cancelled = { ...row, id: "cancelled", place_id: "cancelled-place", is_verified: true, is_cancelled: true };
  const seed = { ...row, id: "seed", place_id: "seed-place", is_verified: true, is_seed: true };
  const passive = { ...row, id: "passive", place_id: "passive-place", is_verified: true, check_in_type: "passive" as const };
  const pending = { ...row, id: "pending", place_id: "pending-place", is_verified: true, checked_in_at: null };
  useSpawterStore.setState({ spawts: [row, cancelled, seed, passive, pending] });
  await useSpawterStore.getState().reconcileVerifiedSpawt({ ...row, is_verified: true, geolocation_source: "gps" });
  expect(useSpawterStore.getState().spawts).toHaveLength(5);
  expect(useSpawterStore.getState().spawter?.unique_spots).toBe(1);
  expect(useSpawterStore.getState().spawter?.total_spawts).toBe(profile.total_spawts);
  expect(useSpawterStore.getState().palais?.confidence_score).toBeGreaterThan(0);
  await useSpawterStore.getState().reconcileVerifiedSpawt({ ...row, id: "unknown", is_verified: true });
  expect(useSpawterStore.getState().spawts).toHaveLength(5);
});
