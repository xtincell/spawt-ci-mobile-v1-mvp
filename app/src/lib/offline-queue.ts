// Story 4.3 — Queue offline pour mutations spawt_checkin (FR-039, NFR-AVAIL-02).
//
// Pattern : local-first AsyncStorage. Le store écrit la row locale immédiatement,
// puis fire-and-forget vers Supabase. Si la sync échoue (offline ou erreur),
// la mutation est enqueue ici. NetInfo détecte le retour réseau et `flush()`
// tente de drainer.
//
// Cap MAX_QUEUE_SIZE = 200, FIFO drop le plus ancien.
// Backoff exponentiel : 0/5/15/30/60 secondes selon `attempts`.
//
// Coordonné mais distinct de la queue analytics (`analytics.ts`) :
//   - Analytics queue → user_signals (append-only batch)
//   - Offline queue (ici) → mutations spawt_checkin (upsert/update)

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SpawtCheckin } from "../types/spawt";

const STORAGE_KEY = "spawt:offline:queue";
const MAX_ATTEMPTS = 5;
const MAX_QUEUE_SIZE = 200;

// Backoff exponentiel : index = attempts précédents → délai avant retry.
const BACKOFF_TABLE_MS: readonly number[] = [0, 5_000, 15_000, 30_000, 60_000];

export type QueueEntry =
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
    };

export type EnqueueInput =
  | { kind: "spawt_insert"; row: SpawtCheckin }
  | { kind: "spawt_update"; row_id: string; patch: Partial<SpawtCheckin> };

export interface FlushResult {
  ok: number;
  failed: number;
  remaining: number;
}

export function backoffDelayMs(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_TABLE_MS.length - 1);
  return BACKOFF_TABLE_MS[idx] ?? BACKOFF_TABLE_MS[BACKOFF_TABLE_MS.length - 1]!;
}

async function loadQueue(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    if (__DEV__) console.warn("[offline-queue] loadQueue failed, returning empty", err);
    return [];
  }
}

async function persistQueue(entries: readonly QueueEntry[]): Promise<void> {
  // FIFO drop si on dépasse le cap.
  const capped =
    entries.length > MAX_QUEUE_SIZE
      ? entries.slice(entries.length - MAX_QUEUE_SIZE)
      : entries;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch (err) {
    if (__DEV__) console.warn("[offline-queue] persistQueue failed", err);
  }
}

/** Enqueue une mutation. Fire-and-forget. */
export async function enqueue(input: EnqueueInput): Promise<void> {
  const now = new Date().toISOString();
  const queue = await loadQueue();
  const entry: QueueEntry = {
    ...input,
    enqueued_at: now,
    attempts: 0,
    last_attempt_at: null,
  };
  queue.push(entry);
  await persistQueue(queue);
}

/** Inspect lecture seule pour Settings → OfflineQueueInspector. */
export async function inspect(): Promise<readonly QueueEntry[]> {
  return [...(await loadQueue())];
}

/** Vide manuellement la queue (Settings purge). */
export async function purge(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export interface SyncBackend {
  /** Upsert idempotent `spawt_insert` (collision PK = update silencieux). */
  upsertSpawt: (row: SpawtCheckin) => Promise<boolean>;
  /** Update partial `spawt_update`. */
  updateSpawt: (row_id: string, patch: Partial<SpawtCheckin>) => Promise<boolean>;
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
 * - MAX_ATTEMPTS = 5 → drop + log __DEV__ (anti-loop).
 */
export async function flush(now: Date = new Date()): Promise<FlushResult> {
  const queue = await loadQueue();
  if (queue.length === 0 || backendRef === null) {
    return { ok: 0, failed: 0, remaining: queue.length };
  }
  const remaining: QueueEntry[] = [];
  let ok = 0;
  let failed = 0;

  for (const entry of queue) {
    // Drop si MAX_ATTEMPTS atteint (no infinite retry loop).
    if (entry.attempts >= MAX_ATTEMPTS) {
      if (__DEV__) {
        console.warn(
          "[offline-queue] dropping entry after MAX_ATTEMPTS",
          entry.kind,
        );
      }
      continue;
    }
    // Backoff — skip cette iteration si on n'a pas attendu assez.
    if (entry.last_attempt_at !== null) {
      const elapsed = now.getTime() - new Date(entry.last_attempt_at).getTime();
      if (elapsed < backoffDelayMs(entry.attempts)) {
        remaining.push(entry);
        continue;
      }
    }
    const success = await tryDrainEntry(entry, backendRef);
    if (success) {
      ok += 1;
    } else {
      failed += 1;
      remaining.push({
        ...entry,
        attempts: entry.attempts + 1,
        last_attempt_at: now.toISOString(),
      });
    }
  }

  await persistQueue(remaining);
  return { ok, failed, remaining: remaining.length };
}

async function tryDrainEntry(
  entry: QueueEntry,
  backend: SyncBackend,
): Promise<boolean> {
  try {
    if (entry.kind === "spawt_insert") {
      return await backend.upsertSpawt(entry.row);
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
  })();

  return options.subscribe(() => {
    void flush();
  });
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
  const success = await tryDrainEntry(
    {
      ...input,
      enqueued_at: new Date().toISOString(),
      attempts: 0,
      last_attempt_at: null,
    } as QueueEntry,
    backendRef,
  );
  if (success) return { persisted: "remote" };
  await enqueue(input);
  return { persisted: "queued" };
}

export const OFFLINE_QUEUE_MAX_SIZE = MAX_QUEUE_SIZE;
export const OFFLINE_QUEUE_MAX_ATTEMPTS = MAX_ATTEMPTS;
