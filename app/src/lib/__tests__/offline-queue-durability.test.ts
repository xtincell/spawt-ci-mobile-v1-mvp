import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  enqueue, flush, inspect, purge, setSyncBackend, _resetForTest,
  OFFLINE_QUEUE_MAX_SIZE, OFFLINE_QUEUE_MAX_ATTEMPTS, type SyncBackend,
} from "../offline-queue";

const KEY = "spawt:offline:queue";
const input = (id: string) => ({ kind: "spawt_update" as const, row_id: id, patch: { texte_avis: id } });
const backend = (update = jest.fn(async () => true)): SyncBackend => ({
  updateSpawt: update,
  upsertSpawt: jest.fn(async () => true),
  upsertSpawter: jest.fn(async () => true),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  await _resetForTest();
});

it("conserve deux actions simultanées après relecture du disque", async () => {
  await Promise.all([enqueue(input("a")), enqueue(input("b"))]);
  expect((await inspect()).map((e) => e.kind === "spawt_update" && e.row_id)).toEqual(["a", "b"]);
});

it("une action ajoutée pendant l'envoi reste durable, sans attendre le réseau", async () => {
  const started = deferred<void>();
  const sent = deferred<boolean>();
  setSyncBackend(backend(jest.fn(() => { started.resolve(); return sent.promise; })));
  await enqueue(input("a"));
  const sending = flush();
  await started.promise;
  await enqueue(input("b"));
  expect(await inspect()).toHaveLength(2);
  sent.resolve(true);
  await sending;
  expect((await inspect()).map((e) => e.kind === "spawt_update" && e.row_id)).toEqual(["b"]);
});

it("deux déclencheurs de synchronisation ne rejouent pas deux fois la même action", async () => {
  const started = deferred<void>();
  const sent = deferred<boolean>();
  const update = jest.fn(() => { started.resolve(); return sent.promise; });
  setSyncBackend(backend(update));
  await enqueue(input("a"));
  const first = flush();
  await started.promise;
  const second = flush();
  await Promise.resolve();
  sent.resolve(true);
  await Promise.all([first, second]);
  expect(update).toHaveBeenCalledTimes(1);
});

it("une écriture refusée ne devient jamais un succès de mise en file", async () => {
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("quota"));
  await expect(enqueue(input("a"))).rejects.toThrow("quota");
});

it("une file illisible n'est pas remplacée par une nouvelle action", async () => {
  await AsyncStorage.setItem(KEY, "{interrompu");
  await expect(enqueue(input("a"))).rejects.toThrow();
  expect(await AsyncStorage.getItem(KEY)).toBe("{interrompu");
});

it("le plafond refuse la nouvelle action et conserve toutes celles déjà en attente", async () => {
  for (let i = 0; i < OFFLINE_QUEUE_MAX_SIZE; i += 1) await enqueue(input(String(i)));
  const before = await AsyncStorage.getItem(KEY);
  await expect(enqueue(input("trop"))).rejects.toThrow();
  expect(await AsyncStorage.getItem(KEY)).toBe(before);
});

it("une panne longue conserve l'action pour une reprise ultérieure", async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify([{
    ...input("a"), enqueued_at: "2026-01-01T00:00:00Z",
    attempts: OFFLINE_QUEUE_MAX_ATTEMPTS, last_attempt_at: "2026-01-01T00:00:00Z",
  }]));
  setSyncBackend(backend(jest.fn(async () => false)));
  expect((await flush()).remaining).toBe(1);
  setSyncBackend(backend());
  expect((await flush(new Date(Date.now() + 120_000))).ok).toBe(1);
  expect(await inspect()).toHaveLength(0);
});

it("une purge explicite pendant un envoi n'est pas annulée par sa réponse tardive", async () => {
  const started = deferred<void>();
  const sent = deferred<boolean>();
  setSyncBackend(backend(jest.fn(() => { started.resolve(); return sent.promise; })));
  await enqueue(input("a"));
  const sending = flush();
  await started.promise;
  await purge();
  await enqueue(input("b"));
  sent.resolve(false);
  await sending;
  expect((await inspect()).map((e) => e.kind === "spawt_update" && e.row_id)).toEqual(["b"]);
});
