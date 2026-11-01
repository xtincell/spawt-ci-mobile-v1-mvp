import AsyncStorage from "@react-native-async-storage/async-storage";
import { EMPTY_PALAIS } from "../../data/seed/sample-spawter";
import { enqueue, enqueueMany, flush, inspect, pendingPalais, setSyncBackend, _resetForTest, type SyncBackend } from "../offline-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const base = { ...EMPTY_PALAIS, spawter_id: "a" };
const backend = (upsertPalais = jest.fn(async () => true), owner = "a"): SyncBackend => ({
  upsertPalais, currentOwner: async () => owner,
  upsertSpawt: jest.fn(async () => true), updateSpawt: jest.fn(async () => true), upsertSpawter: jest.fn(async () => true),
});
beforeEach(async () => { await AsyncStorage.clear(); await _resetForTest(); });

it("un Palais hors réseau survit puis est envoyé avec ses valeurs exactes", async () => {
  const row = { ...base, axe_racines_horizons: -0.31 };
  const write = jest.fn(async () => false);
  setSyncBackend(backend(write));
  await enqueue({ kind: "palais_upsert", row });
  expect((await flush()).failed).toBe(1);
  expect(await pendingPalais("a")).toEqual(row);
  write.mockResolvedValue(true);
  expect((await flush(new Date(Date.now() + 120_000))).ok).toBe(1);
  expect(write).toHaveBeenLastCalledWith(row);
  expect(await inspect()).toEqual([]);
});

it("un ACK ancien n'efface pas le Palais plus récent posé pendant l'envoi", async () => {
  const started = deferred<void>();
  const response = deferred<boolean>();
  const write = jest.fn(() => { started.resolve(); return response.promise; });
  setSyncBackend(backend(write));
  await enqueue({ kind: "palais_upsert", row: base });
  const sending = flush(); await started.promise;
  const next = { ...base, axe_racines_horizons: -0.42 };
  await enqueue({ kind: "palais_upsert", row: next });
  response.resolve(true); await sending;
  expect(await pendingPalais("a")).toEqual(next);
  write.mockResolvedValue(true); await flush();
  expect(write).toHaveBeenLastCalledWith(next);
});

it("la session B ne soumet ni ne supprime le Palais de A", async () => {
  const write = jest.fn(async () => true);
  await enqueue({ kind: "palais_upsert", row: base });
  setSyncBackend(backend(write, "b"));
  expect((await flush()).remaining).toBe(1);
  expect(write).not.toHaveBeenCalled();
  expect(await pendingPalais("b")).toBeNull();
  setSyncBackend(backend(write, "a")); await flush();
  expect(write).toHaveBeenCalledWith(base);
});

it("une écriture locale refusée n'enregistre aucune moitié de la transaction", async () => {
  const before = await AsyncStorage.getItem("spawt:offline:queue");
  const spy = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk_full"));
  await expect(enqueueMany([
    { kind: "spawt_update", row_id: "review", patch: { note_etoiles: 5 } },
    { kind: "palais_upsert", row: base },
  ])).rejects.toThrow("disk_full");
  expect(await AsyncStorage.getItem("spawt:offline:queue")).toBe(before);
  spy.mockRestore();
});
