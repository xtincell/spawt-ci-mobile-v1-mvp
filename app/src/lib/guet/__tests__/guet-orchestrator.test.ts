// Câblage MVP — Tests de l'orchestrateur du Guet.
// Machine à états ENTER/EXIT/notif/finalisation, mocks des primitives natives.

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store[k] = v;
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        delete store[k];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

jest.mock("expo-location", () => ({
  __esModule: true,
  GeofencingEventType: { Enter: 1, Exit: 2 },
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  getLastKnownPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 5.35, longitude: -3.99 } }),
  ),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  startGeofencingAsync: jest.fn(() => Promise.resolve()),
  stopGeofencingAsync: jest.fn(() => Promise.resolve()),
  hasStartedGeofencingAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock("expo-task-manager", () => ({
  __esModule: true,
  defineTask: jest.fn(),
}));

jest.mock("expo-crypto", () => {
  let counter = 0;
  return {
    __esModule: true,
    randomUUID: jest.fn(() => `test-uuid-${++counter}`),
  };
});

jest.mock("expo-router", () => ({
  __esModule: true,
  router: { push: jest.fn() },
}));

const mockSchedule: jest.Mock = jest.fn(() => Promise.resolve("notif-id"));
const mockCancel: jest.Mock = jest.fn(() => Promise.resolve());
jest.mock("../guet-notifications", () => ({
  __esModule: true,
  scheduleGuetPrompt: (...args: unknown[]) => mockSchedule(...args),
  cancelGuetPrompt: (...args: unknown[]) => mockCancel(...args),
  cancelAllGuetNotifications: jest.fn(() => Promise.resolve()),
  registerNotificationResponseHandler: jest.fn(() => () => undefined),
}));

jest.mock("../guet-permissions", () => ({
  __esModule: true,
  ensureNotifPermissionPostOTP: jest.fn(() => Promise.resolve("granted")),
}));

const mockRegisterSpawt: jest.Mock = jest.fn(() => Promise.resolve());
const mockSpawterState = {
  spawter: {
    id: "spawter-1",
    geoloc_consent_at: "2026-06-01T00:00:00.000Z",
  } as unknown,
  hydrating: false,
  registerSpawt: mockRegisterSpawt,
};
jest.mock("../../../store/spawter-store", () => ({
  __esModule: true,
  useSpawterStore: {
    getState: () => mockSpawterState,
    subscribe: jest.fn(() => () => undefined),
  },
}));

jest.mock("../../../store/feature-flags", () => ({
  __esModule: true,
  useFeatureFlagsStore: {
    getState: () => ({
      flags: { "guet-geofence": true },
      hydrate: jest.fn(() => Promise.resolve()),
    }),
  },
}));

jest.mock("../../data-source", () => ({
  __esModule: true,
  dataSourceMode: "supabase",
  listPlaces: jest.fn(() =>
    Promise.resolve([
      { id: "place-1", name: "Chez Tantie", location: { lat: 5.35, lng: -3.99 } },
    ]),
  ),
}));

jest.mock("../../analytics", () => ({
  __esModule: true,
  track: jest.fn(),
}));

const mockSaveOrEnqueue: jest.Mock = jest.fn(() =>
  Promise.resolve({ persisted: "remote" as const }),
);
jest.mock("../../offline-queue", () => ({
  __esModule: true,
  saveSpawtToSupabaseOrEnqueue: (...args: unknown[]) => mockSaveOrEnqueue(...args),
}));

import { router } from "expo-router";
import { ANTIFRAUD_RULES } from "../../../types/spawt";
import {
  handleGeofenceEvent,
  handleNotifResponse,
  finalizeStalePending,
  _resetOrchestratorForTest,
} from "../guet-orchestrator";
import {
  listPending,
  getPending,
  upsertPending,
  _clearPendingForTest,
} from "../guet-pending";
import { buildPendingSpawt } from "../guet-spawt-actions";

const PRESENCE_MS = ANTIFRAUD_RULES.PRESENCE_THRESHOLD_MINUTES * 60_000;
const WINDOW_MS = ANTIFRAUD_RULES.POST_LEAVE_WINDOW_MINUTES * 60_000;
const PLACE = { id: "place-1", name: "Chez Tantie" };

beforeEach(async () => {
  jest.clearAllMocks();
  _resetOrchestratorForTest();
  await _clearPendingForTest();
});

describe("handleGeofenceEvent — ENTER", () => {
  it("crée une row pending vérifiée et schedule la notif 15min", async () => {
    await handleGeofenceEvent("enter", PLACE);

    const rows = await listPending();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.place_id).toBe("place-1");
    expect(row.checked_in_at).toBeNull();
    expect(row.is_verified).toBe(true);
    expect(row.check_in_type).toBe("active");
    expect(row.notified_at).not.toBeNull();
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ row_id: row.id, place_id: "place-1" }),
      ANTIFRAUD_RULES.PRESENCE_THRESHOLD_MINUTES * 60,
    );
  });

  it("ignore un ENTER dupliqué sur une zone déjà ouverte", async () => {
    await handleGeofenceEvent("enter", PLACE);
    await handleGeofenceEvent("enter", PLACE);
    expect(await listPending()).toHaveLength(1);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});

describe("handleGeofenceEvent — EXIT", () => {
  it("passage éclair <15min : annule la notif et supprime la row", async () => {
    await handleGeofenceEvent("enter", PLACE);
    const [row] = await listPending();

    await handleGeofenceEvent("exit", PLACE);

    expect(mockCancel).toHaveBeenCalledWith(row!.id);
    expect(await listPending()).toHaveLength(0);
  });

  it("présence ≥15min : pose left_at et garde la row (fenêtre +30min)", async () => {
    const past = new Date(Date.now() - PRESENCE_MS - 60_000);
    const row = buildPendingSpawt("spawter-1", PLACE.id, past);
    await upsertPending(row);

    await handleGeofenceEvent("exit", PLACE);

    const updated = await getPending(row.id);
    expect(updated?.left_at).not.toBeNull();
    expect(updated?.checked_in_at).toBeNull();
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe("handleNotifResponse", () => {
  it("confirm : ferme la row en active, registerSpawt + persist + modal avis", async () => {
    const past = new Date(Date.now() - PRESENCE_MS);
    const row = buildPendingSpawt("spawter-1", PLACE.id, past);
    await upsertPending(row);

    await handleNotifResponse("confirm", {
      row_id: row.id,
      place_id: PLACE.id,
      place_name: PLACE.name,
    });

    expect(mockRegisterSpawt).toHaveBeenCalledTimes(1);
    const registered = mockRegisterSpawt.mock.calls[0]![0] as {
      check_in_type: string;
      checked_in_at: string | null;
    };
    expect(registered.check_in_type).toBe("active");
    expect(registered.checked_in_at).not.toBeNull();
    expect(mockSaveOrEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "spawt_insert" }),
    );
    expect(await getPending(row.id)).toBeNull();
    expect(router.push).toHaveBeenCalledWith(`/review/${row.id}`);
  });

  it("snooze : re-schedule jusqu'au cap 3, puis finalise en passif", async () => {
    const past = new Date(Date.now() - PRESENCE_MS);
    const row = buildPendingSpawt("spawter-1", PLACE.id, past);
    await upsertPending(row);
    const payload = { row_id: row.id, place_id: PLACE.id, place_name: PLACE.name };

    await handleNotifResponse("snooze", payload); // 1
    await handleNotifResponse("snooze", payload); // 2
    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(mockRegisterSpawt).not.toHaveBeenCalled();

    await handleNotifResponse("snooze", payload); // 3 → cap atteint → passif
    expect(mockRegisterSpawt).toHaveBeenCalledTimes(1);
    const registered = mockRegisterSpawt.mock.calls[0]![0] as { check_in_type: string };
    expect(registered.check_in_type).toBe("passive");
    expect(await getPending(row.id)).toBeNull();
  });

  it("ignore une réponse sur une row inconnue ou déjà fermée", async () => {
    await handleNotifResponse("confirm", {
      row_id: "row-inconnue",
      place_id: PLACE.id,
      place_name: PLACE.name,
    });
    expect(mockRegisterSpawt).not.toHaveBeenCalled();
  });
});

describe("finalizeStalePending", () => {
  it("fenêtre +30min écoulée sans réponse → spawt passif (poids 0.5x)", async () => {
    const arrived = new Date(Date.now() - PRESENCE_MS - WINDOW_MS - 120_000);
    const row = buildPendingSpawt("spawter-1", PLACE.id, arrived);
    row.left_at = new Date(Date.now() - WINDOW_MS - 60_000).toISOString();
    await upsertPending(row);

    await finalizeStalePending();

    expect(mockRegisterSpawt).toHaveBeenCalledTimes(1);
    const registered = mockRegisterSpawt.mock.calls[0]![0] as { check_in_type: string };
    expect(registered.check_in_type).toBe("passive");
    expect(await getPending(row.id)).toBeNull();
  });

  it("fenêtre encore ouverte → row conservée", async () => {
    const arrived = new Date(Date.now() - PRESENCE_MS - 60_000);
    const row = buildPendingSpawt("spawter-1", PLACE.id, arrived);
    row.left_at = new Date(Date.now() - 60_000).toISOString();
    await upsertPending(row);

    await finalizeStalePending();

    expect(mockRegisterSpawt).not.toHaveBeenCalled();
    expect(await getPending(row.id)).not.toBeNull();
  });

  it("row jamais sortie depuis >24h → abandon silencieux", async () => {
    const arrived = new Date(Date.now() - 25 * 60 * 60_000);
    const row = buildPendingSpawt("spawter-1", PLACE.id, arrived);
    await upsertPending(row);

    await finalizeStalePending();

    expect(mockRegisterSpawt).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith(row.id);
    expect(await getPending(row.id)).toBeNull();
  });
});
