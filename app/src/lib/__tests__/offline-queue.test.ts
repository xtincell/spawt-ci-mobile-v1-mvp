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
      upsertSpawter: jest.fn(() => Promise.resolve(true)),
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
      upsertSpawter: jest.fn(() => Promise.resolve(true)),
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

  it("conserve l'entry après MAX_ATTEMPTS pour une reprise ultérieure", async () => {
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(false)),
      updateSpawt: jest.fn(() => Promise.resolve(false)),
      upsertSpawter: jest.fn(() => Promise.resolve(false)),
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
    expect(result.remaining).toBe(1);
  });

  it("respecte le backoff — skip si elapsed < delay", async () => {
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(true)),
      updateSpawt: jest.fn(() => Promise.resolve(true)),
      upsertSpawter: jest.fn(() => Promise.resolve(true)),
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

  // ── Reprise de la création de compte ──────────────────────────────────────
  // Elle était en « lance et oublie » : un échec réseau au moment du
  // consentement laissait un compte qui vit sur le téléphone et n'existe pas
  // en base, sans le moindre signal. Ses spawts partaient ensuite vers un
  // `spawter_id` inconnu et échouaient en cascade sur la clé étrangère.
  it("garde le compte spawter en file tant qu'il n'est pas passé, puis le rejoue", async () => {
    let tentatives = 0;
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(true)),
      updateSpawt: jest.fn(() => Promise.resolve(true)),
      upsertSpawter: jest.fn(() => {
        tentatives += 1;
        return Promise.resolve(tentatives > 1); // hors ligne, puis en ligne
      }),
    };
    setSyncBackend(backend);
    mockStorage.set(
      "spawt:offline:queue",
      JSON.stringify([
        {
          kind: "spawter_upsert",
          row: { id: "sp-1", phone_e164: "+2250700000001", display_name: "Test" },
          enqueued_at: "2026-05-20T11:00:00Z",
          attempts: 0,
          last_attempt_at: null,
        },
      ]),
    );

    const r1 = await flush(new Date("2026-05-20T12:00:00Z"));
    expect(r1.failed).toBe(1);
    expect(r1.remaining).toBe(1); // le compte n'est PAS perdu

    // Assez tard pour que le backoff soit purgé.
    const r2 = await flush(new Date("2026-05-20T12:05:00Z"));
    expect(r2.ok).toBe(1);
    expect(r2.remaining).toBe(0);
    expect(backend.upsertSpawter).toHaveBeenCalledTimes(2);
  });
});

describe("saveSpawtToSupabaseOrEnqueue", () => {
  it("persiste remote si backend succeed", async () => {
    const backend: SyncBackend = {
      upsertSpawt: jest.fn(() => Promise.resolve(true)),
      updateSpawt: jest.fn(() => Promise.resolve(true)),
      upsertSpawter: jest.fn(() => Promise.resolve(true)),
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
      upsertSpawter: jest.fn(() => Promise.resolve(false)),
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

describe("publication durable d'un avis", () => {
  it("fusionne la visite en attente avec son avis au lieu de rejouer une visite sans note", async () => {
    await enqueue({ kind: "spawt_insert", row: makeRow("review") });
    await enqueue({ kind: "spawt_update", row_id: "review", patch: { note_etoiles: 4, note_cuisine: 5, note_cadre: 4, note_service: 4 } });
    const entries = await inspect();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "spawt_insert", row: { note_etoiles: 4, note_cuisine: 5 } });
    const upsertSpawt = jest.fn().mockResolvedValue(true);
    setSyncBackend({ upsertSpawt, updateSpawt: jest.fn(), upsertSpawter: jest.fn() });
    await flush();
    expect(upsertSpawt).toHaveBeenCalledTimes(1);
    expect(upsertSpawt.mock.calls[0]?.[0].note_cuisine).toBe(5);
    expect(await inspect()).toHaveLength(0);
  });
  it("l'ACK d'une ancienne visite en vol ne supprime pas le nouvel avis", async () => {
    let ack!: (ok: boolean) => void;
    const upsertSpawt = jest.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { ack = resolve; })).mockResolvedValue(true);
    setSyncBackend({ upsertSpawt, updateSpawt: jest.fn(), upsertSpawter: jest.fn() });
    await enqueue({ kind: "spawt_insert", row: makeRow("race-review") });
    const sending = flush();
    while (!ack) await Promise.resolve();
    await enqueue({ kind: "spawt_insert", row: { ...makeRow("race-review"), note_etoiles: 4, note_cuisine: 5, note_cadre: 4, note_service: 4 } });
    ack(true); await sending;
    expect(await inspect()).toHaveLength(1);
    await flush();
    expect(upsertSpawt.mock.calls[1]?.[0].note_cuisine).toBe(5);
    expect(await inspect()).toHaveLength(0);
  });
});

it("retente automatiquement après un retour réseau plus rapide que le backoff", async () => {
  jest.useFakeTimers();
  let online = true;
  let network!: () => void;
  const upsertSpawt = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  setSyncBackend({ upsertSpawt, updateSpawt: jest.fn(), upsertSpawter: jest.fn() });
  const { initOfflineQueue } = await import("../offline-queue");
  const stop = initOfflineQueue({ isOnline: () => Promise.resolve(online), subscribe: cb => { network = cb; return () => undefined; } });
  try {
    await enqueue({ kind: "spawt_insert", row: makeRow("early-network") });
    await jest.advanceTimersByTimeAsync(250);
    expect(upsertSpawt).toHaveBeenCalledTimes(1);
    online = false; network(); online = true; network();
    await jest.advanceTimersByTimeAsync(1000);
    expect(upsertSpawt).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(upsertSpawt).toHaveBeenCalledTimes(2);
    expect(await inspect()).toHaveLength(0);
  } finally { stop(); jest.useRealTimers(); }
});
