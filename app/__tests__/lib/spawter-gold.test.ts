// Sprint 2 — isGoldSpawter branché sur l'entitlement (vue active_entitlements
// 0032) : cache module synchrone alimenté par le store + ré-évaluation locale
// de la fenêtre échéance/grâce (un cache persisté périmé ne donne pas un Gold
// fantôme). L'achat vit sur le portail web (Apple 3.1.3).

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
  GOLD_STORAGE_KEY,
  getGoldEntitlementState,
  isEntitlementCurrentlyActive,
  isGoldSpawter,
  loadGoldLocal,
  portalAccountUrl,
  portalGoldUrl,
  saveGoldLocal,
  setGoldEntitlementState,
} from "../../src/lib/spawter-gold";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";
import type { GoldEntitlement } from "../../src/lib/data-source";

const NOW = Date.parse("2026-07-26T12:00:00.000Z");
const FUTURE = "2026-08-26T12:00:00.000Z";
const PAST = "2026-07-20T12:00:00.000Z";
const GRACE_OPEN = "2026-07-27T12:00:00.000Z";

function makeEntitlement(overrides: Partial<GoldEntitlement> = {}): GoldEntitlement {
  return {
    active: true,
    plan: "gold_monthly",
    status: "active",
    expires_at: FUTURE,
    grace_until: null,
    checked_at: new Date(NOW).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  mockStorage.clear();
  setGoldEntitlementState(null);
  jest.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("isGoldSpawter — lecture synchrone de l'état hydraté", () => {
  it("aucun entitlement hydraté → false (mode démo / compte gratuit)", () => {
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("entitlement actif (échéance future) → true", () => {
    setGoldEntitlementState(makeEntitlement());
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);
  });

  it("entitlement en grâce (échéance passée, grace_until ouverte) → true", () => {
    setGoldEntitlementState(
      makeEntitlement({ status: "grace", expires_at: PAST, grace_until: GRACE_OPEN }),
    );
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);
  });

  it("entitlement expiré (échéance ET grâce passées) → false", () => {
    setGoldEntitlementState(
      makeEntitlement({ status: "grace", expires_at: PAST, grace_until: PAST }),
    );
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("cache périmé : active=true mais échéance passée sans grâce → false", () => {
    // Le serveur disait « actif » à la dernière revalidation, mais l'échéance
    // est passée depuis (device offline) : la ré-évaluation locale dégrade.
    setGoldEntitlementState(makeEntitlement({ expires_at: PAST }));
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("active=false (aucune ligne dans la vue) → false", () => {
    setGoldEntitlementState(
      makeEntitlement({ active: false, plan: null, status: null, expires_at: null }),
    );
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("statut hors active/grace (cancelled) → false", () => {
    setGoldEntitlementState(makeEntitlement({ status: "cancelled" }));
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("reset (setGoldEntitlementState(null)) → false", () => {
    setGoldEntitlementState(makeEntitlement());
    setGoldEntitlementState(null);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });
});

describe("isEntitlementCurrentlyActive — miroir du prédicat is_active (0032)", () => {
  it("sans échéance (expires_at null) → true tant que le statut est bon", () => {
    expect(isEntitlementCurrentlyActive(makeEntitlement({ expires_at: null }))).toBe(true);
  });

  it("null → false", () => {
    expect(isEntitlementCurrentlyActive(null)).toBe(false);
  });
});

describe("URLs portail (achat/gestion HORS app — Apple 3.1.3)", () => {
  it("portalGoldUrl pointe la page Gold du portail", () => {
    expect(portalGoldUrl()).toBe("https://spawt.online/gold");
  });

  it("portalAccountUrl pointe la page compte du portail", () => {
    expect(portalAccountUrl()).toBe("https://spawt.online/compte");
  });
});

describe("persistance locale (cache offline-first revalidé par le store)", () => {
  it("roundtrip saveGoldLocal → loadGoldLocal", async () => {
    const entitlement = makeEntitlement();
    expect(await saveGoldLocal(entitlement)).toBe(true);
    expect(await loadGoldLocal()).toEqual(entitlement);
  });

  it("cache absent → null", async () => {
    expect(await loadGoldLocal()).toBeNull();
  });

  it("cache corrompu (JSON invalide) → null, pas de crash", async () => {
    mockStorage.set(GOLD_STORAGE_KEY, "pas-du-json-{");
    expect(await loadGoldLocal()).toBeNull();
  });

  it("cache de forme inattendue (active non-booléen) → null", async () => {
    mockStorage.set(GOLD_STORAGE_KEY, JSON.stringify({ active: "oui" }));
    expect(await loadGoldLocal()).toBeNull();
  });
});

describe("getGoldEntitlementState — accès debug", () => {
  it("reflète le dernier set", () => {
    const e = makeEntitlement();
    setGoldEntitlementState(e);
    expect(getGoldEntitlementState()).toBe(e);
  });
});
