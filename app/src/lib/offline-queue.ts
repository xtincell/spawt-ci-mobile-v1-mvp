// Story 4.3 — Queue offline pour mutations spawt_checkin (FR-039, NFR-AVAIL-02).
//
// Pattern : local-first AsyncStorage. Le store écrit la row locale immédiatement,
// puis fire-and-forget vers Supabase. Si la sync échoue (offline ou erreur),
// la mutation est enqueue ici. NetInfo détecte le retour réseau et `flush()`
// tente de drainer.
//
// Cap MAX_QUEUE_SIZE = 200 : refuse l'ajout, jamais une action déjà acceptée.
// Backoff exponentiel : 0/5/15/30/60 secondes selon `attempts`.
//
// Coordonné mais distinct de la queue analytics (`analytics.ts`) :
//   - Analytics queue → user_signals (append-only batch)
//   - Offline queue (ici) → mutations spawt_checkin (upsert/update)

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SpawtCheckin } from "../types/spawt";
import type { Spawter } from "../types/spawter";
import { notifyReviewChanged } from "./review-events";

const STORAGE_KEY = "spawt:offline:queue";
const MAX_ATTEMPTS = 5;
const MAX_QUEUE_SIZE = 200;

// Backoff exponentiel : index = attempts précédents → délai avant retry.
const BACKOFF_TABLE_MS: readonly number[] = [0, 5_000, 15_000, 30_000, 60_000];

export type QueueEntry = (
  | {
      kind: "spawt_insert";
      row: SpawtCheckin;
      enqueued_at: string;
      attempts: number;
      last_attempt_at: string | null;
    }
  | {
      kind: "spawt_update";
      row_id: string;
      patch: Partial<SpawtCheckin>;
      enqueued_at: string;
      attempts: number;
      last_attempt_at: string | null;
    }
  | {
      // La création du compte côté serveur était en « lance et oublie » :
      // `void saveSpawter(...).catch(warn)`, sans reprise. Un échec réseau au
      // moment du consentement laissait un compte qui vit sur le téléphone et
      // n'existe nulle part en base — sans le moindre signal. Ses spawts
      // partaient ensuite vers un `spawter_id` inconnu et échouaient en
      // cascade sur la clé étrangère. La file le rattrape maintenant, au même
      // titre qu'un spawt.
      kind: "spawter_upsert";
      row: Spawter;
      enqueued_at: string;
      attempts: number;
      last_attempt_at: string | null;
    }) & { queue_id?: string };

export type EnqueueInput =
  | { kind: "spawt_insert"; row: SpawtCheckin }
  | { kind: "spawt_update"; row_id: string; patch: Partial<SpawtCheckin> }
  | { kind: "spawter_upsert"; row: Spawter };

export interface FlushResult {
  ok: number;
  failed: number;
  remaining: number;
}

export function backoffDelayMs(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_TABLE_MS.length - 1);
  return BACKOFF_TABLE_MS[idx] ?? BACKOFF_TABLE_MS[BACKOFF_TABLE_MS.length - 1]!;
}

// Sérialise uniquement les lectures/écritures locales. Aucun appel réseau ne
// tient ce verrou : une nouvelle action reste enregistrable pendant un envoi.
let storageTail: Promise<unknown> = Promise.resolve();
function withStorage<T>(action: () => Promise<T>): Promise<T> {
  const result = storageTail.then(action);
  storageTail = result.catch(() => undefined);
  return result;
}

let idCounter = 0;
function nextQueueId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2)}`;
}

async function loadQueue(): Promise<QueueEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((e: unknown) => {
    if (!e || typeof e !== "object") return true;
    const v = e as Record<string, unknown>;
    return !["spawt_insert", "spawt_update", "spawter_upsert"].includes(String(v.kind)) ||
      typeof v.enqueued_at !== "string" || !Number.isFinite(Date.parse(v.enqueued_at)) ||
      typeof v.attempts !== "number" || !Number.isInteger(v.attempts) || v.attempts < 0 ||
      !(v.last_attempt_at === null || (typeof v.last_attempt_at === "string" && Number.isFinite(Date.parse(v.last_attempt_at)))) ||
      (v.queue_id !== undefined && (typeof v.queue_id !== "string" || !v.queue_id)) ||
      (v.kind === "spawt_update"
        ? typeof v.row_id !== "string" || !v.row_id || !v.patch || typeof v.patch !== "object" || Array.isArray(v.patch)
        : !v.row || typeof v.row !== "object" || typeof (v.row as Record<string, unknown>).id !== "string");
  })) {
    throw new Error("offline_queue_invalid");
  }
  const entries = parsed as QueueEntry[];
  const ids = entries.flatMap((e) => e.queue_id ? [e.queue_id] : []);
  if (new Set(ids).size !== ids.length) throw new Error("offline_queue_invalid");
  return entries;
}

async function persistQueue(entries: readonly QueueEntry[]): Promise<void> {
  // Un rejet remonte au caller ; « queued » implique une écriture réussie.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Acquitte une mutation uniquement après sa persistance locale. */
export async function enqueue(input: EnqueueInput): Promise<void> {
  await withStorage(async () => {
    const queue = await loadQueue();
    // Une visite en attente ne doit jamais écraser plus tard son avis publié.
    // Une nouvelle identité protège aussi contre l'ACK d'un ancien snapshot.
    if (input.kind === "spawt_insert") {
      const idx = queue.findIndex(e => e.kind === "spawt_insert" && e.row.id === input.row.id);
      if (idx >= 0) {
        queue[idx] = { ...input, queue_id: nextQueueId(), enqueued_at: new Date().toISOString(),
          attempts: 0, last_attempt_at: null };
        await persistQueue(queue);
        return;
      }
    }
    if (input.kind === "spawt_update") {
      const idx = queue.findIndex(e => e.kind === "spawt_insert" && e.row.id === input.row_id);
      const pending = queue[idx];
      if (pending?.kind === "spawt_insert") {
        queue[idx] = { ...pending, row: { ...pending.row, ...input.patch }, queue_id: nextQueueId(),
          enqueued_at: new Date().toISOString(), attempts: 0, last_attempt_at: null };
        await persistQueue(queue);
        return;
      }
    }
    if (queue.length >= MAX_QUEUE_SIZE) throw new Error("offline_queue_full");
    queue.push({ ...input, queue_id: nextQueueId(), enqueued_at: new Date().toISOString(),
                 attempts: 0, last_attempt_at: null });
    await persistQueue(queue);
  });
}

/** Inspect lecture seule pour Settings → OfflineQueueInspector. */
export async function inspect(): Promise<readonly QueueEntry[]> {
  return withStorage(loadQueue);
}

/** Vide manuellement la queue (Settings purge). */
export async function purge(): Promise<void> {
  await withStorage(() => AsyncStorage.removeItem(STORAGE_KEY));
}

export interface SyncBackend {
  /** Upsert idempotent `spawt_insert` (collision PK = update silencieux). */
  upsertSpawt: (row: SpawtCheckin) => Promise<boolean>;
  /** Update partial `spawt_update`. */
  updateSpawt: (row_id: string, patch: Partial<SpawtCheckin>) => Promise<boolean>;
  /** Upsert du compte spawter — idempotent (PK = id). */
  upsertSpawter: (row: Spawter) => Promise<boolean>;
}

let backendRef: SyncBackend | null = null;

/** Injection du backend (par data-source.supabase). Story 4.3 Task 3. */
export function setSyncBackend(backend: SyncBackend | null): void {
  backendRef = backend;
}

/** Test-only — reset state (queue + backend) avant chaque test. */
export async function _resetForTest(): Promise<void> {
  await purge();
  backendRef = null;
}

/**
 * Tente de drainer la queue. Iteration FIFO (`enqueued_at` ascendant).
 * - Backoff exponentiel par entry via `last_attempt_at` + `attempts`.
 * - Jamais de suppression sur échec : le backoff reste plafonné à 60 s.
 * - Les déclencheurs simultanés partagent le même envoi.
 */
let flushInFlight: Promise<FlushResult> | null = null;
export function flush(now: Date = new Date()): Promise<FlushResult> {
  if (flushInFlight) return flushInFlight;
  const promise = drainQueue(now);
  flushInFlight = promise;
  const release = () => { if (flushInFlight === promise) flushInFlight = null; };
  void promise.then(release, release);
  return promise;
}

async function drainQueue(now: Date): Promise<FlushResult> {
  const backend = backendRef;
  const queue = await withStorage(async () => {
    const entries = await loadQueue();
    // Migration des anciennes entrées : identité persistée AVANT le réseau.
    if (backend && entries.some((e) => !e.queue_id)) {
      for (const e of entries) e.queue_id ??= nextQueueId();
      await persistQueue(entries);
    }
    return entries;
  });
  if (queue.length === 0 || backend === null) {
    return { ok: 0, failed: 0, remaining: queue.length };
  }
  const outcomes = new Map<string, QueueEntry | null>();
  let ok = 0;
  let failed = 0;

  for (const entry of queue) {
    // Backoff — skip cette iteration si on n'a pas attendu assez.
    if (entry.last_attempt_at !== null) {
      const elapsed = now.getTime() - new Date(entry.last_attempt_at).getTime();
      if (elapsed < backoffDelayMs(entry.attempts)) {
        continue;
      }
    }
    const success = await tryDrainEntry(entry, backend);
    if (success) {
      ok += 1;
      outcomes.set(entry.queue_id!, null);
    } else {
      failed += 1;
      outcomes.set(entry.queue_id!, {
        ...entry,
        attempts: entry.attempts + 1,
        last_attempt_at: now.toISOString(),
      });
    }
  }

  return withStorage(async () => {
    // Relit le disque : un ajout ou une purge survenu pendant le réseau fait
    // foi. Seules les entrées du snapshot encore présentes sont acquittées.
    const current = await loadQueue();
    const remaining = current.flatMap((entry) => {
      if (!entry.queue_id || !outcomes.has(entry.queue_id)) return [entry];
      const result = outcomes.get(entry.queue_id);
      return result ? [result] : [];
    });
    await persistQueue(remaining);
    return { ok, failed, remaining: remaining.length };
  });
}

async function tryDrainEntry(
  entry: QueueEntry,
  backend: SyncBackend,
): Promise<boolean> {
  try {
    if (entry.kind === "spawt_insert") {
      const ok = await backend.upsertSpawt(entry.row);
      if (ok && entry.row.note_etoiles !== null) notifyReviewChanged(entry.row.place_id);
      return ok;
    }
    if (entry.kind === "spawter_upsert") {
      return await backend.upsertSpawter(entry.row);
    }
    return await backend.updateSpawt(entry.row_id, entry.patch);
  } catch (err) {
    if (__DEV__) console.warn("[offline-queue] entry drain failed", err);
    return false;
  }
}

export interface InitOptions {
  /** Notifie sur transitions réseau false → true. Cb fourni par caller. */
  subscribe: (cb: () => void) => () => void;
  /** Lit le state réseau courant (true = online). */
  isOnline: () => Promise<boolean>;
}

/**
 * Setup au boot. Branche un listener réseau + tente un flush initial si la
 * queue n'est pas vide. Retourne une fonction d'unsubscribe.
 *
 * Le caller (Root layout) fournit l'adaptateur NetInfo via `subscribe` + `isOnline`
 * pour rester découplé de `@react-native-community/netinfo` (testable + Web fallback).
 */
export function initOfflineQueue(options: InitOptions): () => void {
  // Flush initial — catch-up post-relaunch.
  void (async () => {
    const online = await options.isOnline().catch(() => false);
    if (online) await flush();
  })().catch(reportFlushFailure);

  return options.subscribe(() => {
    void flush().catch(reportFlushFailure);
  });
}

function reportFlushFailure(error: unknown): void {
  if (__DEV__) console.warn("[offline-queue] reprise non acquittée", error);
}

/**
 * Helper Story 4.3 AC #2 — wrapper "essaie sync, sinon enqueue".
 * À utiliser dans `data-source.ts` quand on tente un mutation `spawt_checkin`.
 */
export async function saveSpawtToSupabaseOrEnqueue(
  input: EnqueueInput,
): Promise<{ persisted: "remote" | "queued" }> {
  if (backendRef === null) {
    await enqueue(input);
    return { persisted: "queued" };
  }
  await enqueue(input);
  await flush();
  const pending = await inspect();
  const remains = pending.some(e => input.kind === "spawter_upsert"
    ? e.kind === "spawter_upsert" && e.row.id === input.row.id
    : e.kind === "spawt_insert" ? e.row.id === (input.kind === "spawt_insert" ? input.row.id : input.row_id)
      : e.kind === "spawt_update" && e.row_id === (input.kind === "spawt_insert" ? input.row.id : input.row_id));
  return { persisted: remains ? "queued" : "remote" };
}

export const OFFLINE_QUEUE_MAX_SIZE = MAX_QUEUE_SIZE;
/** Seuil historique conservé pour les outils existants ; ce n'est plus un seuil de suppression. */
export const OFFLINE_QUEUE_MAX_ATTEMPTS = MAX_ATTEMPTS;
