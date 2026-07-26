// Feature 13 — Tests de push-token.ts : enregistrement du token Expo,
// dégradation propre (permission refusée, FCM absent), retrait au logout,
// et routage deep link des taps de notification push serveur.

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

const mockGetExpoPushToken: jest.Mock = jest.fn(() =>
  Promise.resolve({ data: "ExponentPushToken[test-1]" }),
);
const mockSetChannel: jest.Mock = jest.fn(() => Promise.resolve());
const mockAddResponseListener: jest.Mock = jest.fn(() => ({ remove: jest.fn() }));
jest.mock("expo-notifications", () => ({
  __esModule: true,
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushToken(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddResponseListener(...args),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { eas: { projectId: "15ac2301-e901-4caa-a8c8-864c6621bcd0" } },
    },
  },
}));

const mockRouterPush: jest.Mock = jest.fn();
jest.mock("expo-router", () => ({
  __esModule: true,
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

const mockUpsertPushToken: jest.Mock = jest.fn(() => Promise.resolve());
const mockDeletePushToken: jest.Mock = jest.fn(() => Promise.resolve());
jest.mock("../data-source", () => ({
  __esModule: true,
  upsertPushToken: (...args: unknown[]) => mockUpsertPushToken(...args),
  deletePushToken: (...args: unknown[]) => mockDeletePushToken(...args),
}));

const mockEnsureNotifPermission: jest.Mock = jest.fn(() => Promise.resolve("granted"));
jest.mock("../guet/guet-permissions", () => ({
  __esModule: true,
  ensureNotifPermissionPostOTP: (...args: unknown[]) =>
    mockEnsureNotifPermission(...args),
}));

const mockSpawterState: { spawter: { id: string; geoloc_consent_at: string | null } | null } = {
  spawter: { id: "spawter-1", geoloc_consent_at: "2026-06-01T00:00:00.000Z" },
};
jest.mock("../../store/spawter-store", () => ({
  __esModule: true,
  useSpawterStore: {
    getState: () => mockSpawterState,
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  registerPushToken,
  unregisterPushToken,
  registerPushResponseHandler,
  resolvePushDeepLink,
  _resetPushTokenStateForTest,
} from "../push-token";

describe("registerPushToken", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    _resetPushTokenStateForTest();
    await AsyncStorage.clear();
    mockSpawterState.spawter = {
      id: "spawter-1",
      geoloc_consent_at: "2026-06-01T00:00:00.000Z",
    };
    mockEnsureNotifPermission.mockResolvedValue("granted");
    mockGetExpoPushToken.mockResolvedValue({ data: "ExponentPushToken[test-1]" });
    mockUpsertPushToken.mockResolvedValue(undefined);
    mockDeletePushToken.mockResolvedValue(undefined);
  });

  it("succès → retourne le token et upsert via le data layer", async () => {
    const token = await registerPushToken();
    expect(token).toBe("ExponentPushToken[test-1]");
    // projectId lu depuis extra.eas.projectId (pas en dur dans l'appel).
    expect(mockGetExpoPushToken).toHaveBeenCalledWith({
      projectId: "15ac2301-e901-4caa-a8c8-864c6621bcd0",
    });
    // jest-expo → Platform.OS === "ios" par défaut.
    expect(mockUpsertPushToken).toHaveBeenCalledWith("ExponentPushToken[test-1]", "ios");
  });

  it("permission refusée → null sans throw, aucun upsert", async () => {
    mockEnsureNotifPermission.mockResolvedValue("denied");
    await expect(registerPushToken()).resolves.toBeNull();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockUpsertPushToken).not.toHaveBeenCalled();
  });

  it("consentement absent (permission 'skipped') → null, aucun upsert", async () => {
    mockSpawterState.spawter = { id: "spawter-1", geoloc_consent_at: null };
    mockEnsureNotifPermission.mockResolvedValue("skipped");
    await expect(registerPushToken()).resolves.toBeNull();
    expect(mockEnsureNotifPermission).toHaveBeenCalledWith(false);
    expect(mockUpsertPushToken).not.toHaveBeenCalled();
  });

  it("pas de spawter (pré-onboarding) → null sans demande de permission", async () => {
    mockSpawterState.spawter = null;
    await expect(registerPushToken()).resolves.toBeNull();
    expect(mockEnsureNotifPermission).not.toHaveBeenCalled();
  });

  it("FCM absent (getExpoPushTokenAsync throw) → null sans throw, warn une seule fois", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockGetExpoPushToken.mockRejectedValue(new Error("Default FirebaseApp is not initialized"));
    await expect(registerPushToken()).resolves.toBeNull();
    await expect(registerPushToken()).resolves.toBeNull();
    // Warn-once : le 2e échec ne re-log pas (dégradation silencieuse documentée).
    const pushWarns = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].startsWith("[push-token]"),
    );
    expect(pushWarns).toHaveLength(1);
    expect(mockUpsertPushToken).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("échec de l'upsert Supabase → le token est quand même retourné (retry au prochain boot)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockUpsertPushToken.mockRejectedValue(new Error("network down"));
    await expect(registerPushToken()).resolves.toBe("ExponentPushToken[test-1]");
    warnSpy.mockRestore();
  });
});

describe("unregisterPushToken", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    _resetPushTokenStateForTest();
    await AsyncStorage.clear();
    mockSpawterState.spawter = {
      id: "spawter-1",
      geoloc_consent_at: "2026-06-01T00:00:00.000Z",
    };
    mockEnsureNotifPermission.mockResolvedValue("granted");
    mockGetExpoPushToken.mockResolvedValue({ data: "ExponentPushToken[test-1]" });
    mockUpsertPushToken.mockResolvedValue(undefined);
    mockDeletePushToken.mockResolvedValue(undefined);
  });

  it("après un register, supprime le token persisté via le data layer", async () => {
    await registerPushToken();
    await unregisterPushToken();
    expect(mockDeletePushToken).toHaveBeenCalledWith("ExponentPushToken[test-1]");
    // Idempotent : un 2e appel ne retrouve plus de token local.
    mockDeletePushToken.mockClear();
    await unregisterPushToken();
    expect(mockDeletePushToken).not.toHaveBeenCalled();
  });

  it("sans token persisté → no-op sans throw", async () => {
    await expect(unregisterPushToken()).resolves.toBeUndefined();
    expect(mockDeletePushToken).not.toHaveBeenCalled();
  });

  it("échec du DELETE → ne throw pas (row purgée plus tard par push-send)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await registerPushToken();
    mockDeletePushToken.mockRejectedValue(new Error("network down"));
    await expect(unregisterPushToken()).resolves.toBeUndefined();
    warnSpy.mockRestore();
  });
});

describe("resolvePushDeepLink", () => {
  it("chemin interne → accepté tel quel", () => {
    expect(resolvePushDeepLink({ deep_link: "/place/abc" })).toBe("/place/abc");
  });

  it("scheme app spawt:// → normalisé en chemin interne", () => {
    expect(resolvePushDeepLink({ deep_link: "spawt://place/abc" })).toBe("/place/abc");
  });

  it("payload du Guet (row_id) → ignoré, laissé au listener guet-notifications", () => {
    expect(
      resolvePushDeepLink({ row_id: "row-1", place_id: "p-1", deep_link: "/place/abc" }),
    ).toBeNull();
  });

  it("URL web / protocole relatif → refusés (pas de nav arbitraire)", () => {
    expect(resolvePushDeepLink({ deep_link: "https://evil.example/x" })).toBeNull();
    expect(resolvePushDeepLink({ deep_link: "//evil.example/x" })).toBeNull();
  });

  it("deep_link absent ou non-string → null", () => {
    expect(resolvePushDeepLink({})).toBeNull();
    expect(resolvePushDeepLink({ deep_link: 42 })).toBeNull();
    expect(resolvePushDeepLink(null)).toBeNull();
  });
});

describe("registerPushResponseHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetPushTokenStateForTest();
  });

  function makeEvent(data: Record<string, unknown>) {
    return { notification: { request: { content: { data } } } };
  }

  it("tap avec deep_link → router.push vers le chemin", () => {
    registerPushResponseHandler();
    const listener = mockAddResponseListener.mock.calls[0][0] as (e: unknown) => void;
    listener(makeEvent({ deep_link: "/place/abc", type: "gold_renewal" }));
    expect(mockRouterPush).toHaveBeenCalledWith("/place/abc");
  });

  it("tap d'une notif du Guet (row_id) → aucune navigation ici", () => {
    registerPushResponseHandler();
    const listener = mockAddResponseListener.mock.calls[0][0] as (e: unknown) => void;
    listener(makeEvent({ row_id: "row-1", place_id: "p-1" }));
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("unsubscribe retire la subscription ; re-register remplace la précédente", () => {
    const remove = jest.fn();
    mockAddResponseListener.mockReturnValue({ remove });
    const unsubscribe = registerPushResponseHandler();
    registerPushResponseHandler(); // remplace → remove() de la 1re
    expect(remove).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
