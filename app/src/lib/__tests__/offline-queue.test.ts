// Story 4.3 — Tests offline-queue.

const mockStorage = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStorage.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      mockStorage.set(k, v);
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      mockStorage.delete(k);
      return Promise.resolve();
    }),
  },
}));

import {
  enqueue,
  flush,
  inspect,
  purge,
  setSyncBackend,
  backoffDelayMs,
  saveSpawtToSupabaseOrEnqueue,
  _resetForTest,
  OFFLINE_QUEUE_MAX_ATTEMPTS,
  type SyncBackend,
} from "../offline-queue";
import type { SpawtCheckin } from "../../types/spawt";

function makeRow(id: string): SpawtCheckin {
  return {
    id,
    spawter_id: "sp1",
    place_id: "place-bo-zinc",
    arrived_at: "2026-05-20T11:30:00Z",
    notified_at: null,
    snoozed_at: null,
    snooze_count: 0,
    checked_in_at: null,
    left_at: null,
    check_in_type: "active",
    session_duration_minutes: null,
    geolocation_lat: 5.35,
    geolocation_lng: -3.97,
    accuracy_meters: 12,
    geolocation_source: "gps",
    distance_to_lieu_meters: 4,
    is_verified: true,
    flag_reason: null,
    note_etoiles: null,
    texte_avis: null,
    tags: [],
    photos: [],
    is_cancelled: false,
    is_seed: false,
    created_at: "2026-05-20T11:30:00Z",
    updated_at: "2026-05-20T11:30:00Z",
  };
}

beforeEach(async () => {
  mockStorage.clear();
  await _resetForTest();
});

describe("backoffDelayMs", () => {
  it("table progressive 0/5s/15s/30s/60s", () => {
    expect(backoffDelayMs(0)).toBe(0);
    expect(backoffDelayMs(1)).toBe(5_000);
    expect(backoffDelayMs(2)).toBe(15_000);
    expect(backoffDelayMs(3)).toBe(30_000);
    expect(backoffDelayMs(4)).toBe(60_000);
    expect(backoffDelayMs(99)).toBe(60_000);
  });
});

describe("enqueue / inspect / purge", () => {
  it("enqueue ajoute une entrée à AsyncStorage", async () => {
    await enqueue({ kind: "spawt_insert", row: makeRow("a") });
    const list = await inspect();
    expect(list).toHaveLength(1);
    expect(list[0]?.kind).toBe("spawt_insert");
  });

  it("inspect retourne FIFO order", async () => {
    await enqueue({ kind: "spawt_insert", row: makeRow("a") });
    await enqueue({ kind: "spawt_insert", row: makeRow("b") });
    const list = await inspect();
    expect(list).toHaveLength(2);
    expect((list[0] as { kind: string; row?: { id?: string } }).row?.id).toBe("a");
    expect((list[1] as { kind: string; row?: { id?: string } }).row?.id).toBe("b");
  });

  it("purge vide la queue", async () => {
    await enqueue({ kind: "spawt_insert", row: makeRow("a") });
    await purge();
    expect(await inspect()).toHaveLength(0);
  });
});

describe("flush", () => {
  it("ok pour 3 entries quand backend retourne true", async () => {
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(true)),
      updateSpawt: jest.fn(() => Promise.resolve(true)),
    };
    setSyncBackend(backend);
    await enqueue({ kind: "spawt_insert", row: makeRow("a") });
    await enqueue({ kind: "spawt_insert", row: makeRow("b") });
    await enqueue({ kind: "spawt_insert", row: makeRow("c") });
    const result = await flush();
    expect(result).toEqual({ ok: 3, failed: 0, remaining: 0 });
    expect(await inspect()).toHaveLength(0);
  });

  it("garde les entries failed avec attempts incrémenté", async () => {
    let calls = 0;
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => {
        calls += 1;
        return Promise.resolve(calls === 1); // 1er succès, 2e+3e échec
      }),
      updateSpawt: jest.fn(() => Promise.resolve(true)),
    };
    setSyncBackend(backend);
    await enqueue({ kind: "spawt_insert", row: makeRow("a") });
    await enqueue({ kind: "spawt_insert", row: makeRow("b") });
    await enqueue({ kind: "spawt_insert", row: makeRow("c") });
    const result = await flush();
    expect(result.ok).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.remaining).toBe(2);
    const remaining = await inspect();
    expect(remaining[0]?.attempts).toBe(1);
  });

  it("drop l'entry après MAX_ATTEMPTS", async () => {
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(false)),
      updateSpawt: jest.fn(() => Promise.resolve(false)),
    };
    setSyncBackend(backend);
    // Pre-seed une entry avec attempts === MAX_ATTEMPTS - 1, last_attempt très ancien.
    mockStorage.set(
      "spawt:offline:queue",
      JSON.stringify([
        {
          kind: "spawt_insert",
          row: makeRow("a"),
          enqueued_at: "2025-01-01T00:00:00Z",
          attempts: OFFLINE_QUEUE_MAX_ATTEMPTS,
          last_attempt_at: "2025-01-01T00:00:00Z",
        },
      ]),
    );
    const result = await flush();
    expect(result.ok).toBe(0);
    expect(result.remaining).toBe(0); // dropped
  });

  it("respecte le backoff — skip si elapsed < delay", async () => {
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(true)),
      updateSpawt: jest.fn(() => Promise.resolve(true)),
    };
    setSyncBackend(backend);
    const now = new Date("2026-05-20T12:00:00Z");
    mockStorage.set(
      "spawt:offline:queue",
      JSON.stringify([
        {
          kind: "spawt_insert",
          row: makeRow("a"),
          enqueued_at: "2026-05-20T11:59:58Z",
          attempts: 2,
          last_attempt_at: "2026-05-20T11:59:55Z", // 5s ago, backoff = 15s → skip
        },
      ]),
    );
    const result = await flush(now);
    expect(result.ok).toBe(0);
    expect(result.remaining).toBe(1);
    expect(backend.upsertSpawt).not.toHaveBeenCalled();
  });
});

describe("saveSpawtToSupabaseOrEnqueue", () => {
  it("persiste remote si backend succeed", async () => {
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(true)),
      updateSpawt: jest.fn(() => Promise.resolve(true)),
    };
    setSyncBackend(backend);
    const out = await saveSpawtToSupabaseOrEnqueue({
      kind: "spawt_insert",
      row: makeRow("a"),
    });
    expect(out.persisted).toBe("remote");
    expect(await inspect()).toHaveLength(0);
  });

  it("enqueue si backend échoue", async () => {
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(false)),
      updateSpawt: jest.fn(() => Promise.resolve(false)),
    };
    setSyncBackend(backend);
    const out = await saveSpawtToSupabaseOrEnqueue({
      kind: "spawt_insert",
      row: makeRow("a"),
    });
    expect(out.persisted).toBe("queued");
    expect(await inspect()).toHaveLength(1);
  });

  it("enqueue si pas de backend (boot pre-init)", async () => {
    setSyncBackend(null);
    const out = await saveSpawtToSupabaseOrEnqueue({
      kind: "spawt_insert",
      row: makeRow("a"),
    });
    expect(out.persisted).toBe("queued");
  });
});
