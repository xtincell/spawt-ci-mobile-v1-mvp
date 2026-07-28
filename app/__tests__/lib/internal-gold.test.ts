// Comptes internes (migration 0060) — la bascule « voir l'app comme un Gold ».
//
// Ce que ces tests protègent : une bascule locale de droit premium est
// exactement le genre de chose qui devient un contournement d'abonnement si le
// garde saute. Les quatre invariants tenus ici sont donc, dans l'ordre :
//   1. sans statut interne SERVEUR, la bascule est inerte ;
//   2. avec le statut, elle fait voir Gold — c'est son unique raison d'être ;
//   3. perdre le statut (retrait décidé en console admin) coupe la bascule ;
//   4. elle n'enlève jamais un droit réellement payé.

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
  INTERNAL_GOLD_KEY,
  isGoldSpawter,
  isInternalAccount,
  isInternalGoldPreview,
  loadInternalGoldPreview,
  saveInternalGoldPreview,
  setGoldEntitlementState,
  setInternalAccount,
  setInternalGoldPreview,
} from "../../src/lib/spawter-gold";
import { SAMPLE_SPAWTER } from "../../src/data/seed/sample-spawter";
import type { GoldEntitlement } from "../../src/lib/data-source";

const GOLD_REEL: GoldEntitlement = {
  active: true,
  status: "active",
  plan: "gold_monthly",
  expires_at: "2099-01-01T00:00:00.000Z",
  grace_until: null,
  checked_at: "2026-07-28T00:00:00.000Z",
};

beforeEach(() => {
  mockStorage.clear();
  setGoldEntitlementState(null);
  setInternalAccount(false);
});

describe("bascule interne — le garde", () => {
  it("est inerte sur un compte ordinaire : la bascule ne donne pas Gold", () => {
    setInternalGoldPreview(true);
    expect(isInternalAccount()).toBe(false);
    expect(isInternalGoldPreview()).toBe(false);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });

  it("fait voir Gold à un compte interne, sans aucun entitlement", () => {
    setInternalAccount(true);
    setInternalGoldPreview(true);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);
  });

  it("retirer le statut coupe la bascule (retrait console admin)", () => {
    setInternalAccount(true);
    setInternalGoldPreview(true);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);

    setInternalAccount(false); // l'admin a retiré le statut
    expect(isInternalGoldPreview()).toBe(false);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);

    // Et le statut re-posé ne ressuscite pas l'ancienne bascule : il faut la
    // ré-armer explicitement. Un droit qui revient tout seul est un droit qu'on
    // ne contrôle plus.
    setInternalAccount(true);
    expect(isInternalGoldPreview()).toBe(false);
  });

  it("n'enlève jamais un droit réellement payé", () => {
    setGoldEntitlementState(GOLD_REEL);
    setInternalAccount(true);
    setInternalGoldPreview(false);
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);
  });

  it("ne donne rien de plus à un compte ordinaire même si la clé disque est forgée", async () => {
    // Scénario : quelqu'un pose la clé à la main sur un appareil rooté.
    mockStorage.set(INTERNAL_GOLD_KEY, "true");
    setInternalGoldPreview(await loadInternalGoldPreview()); // statut jamais posé
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(false);
  });
});

describe("bascule interne — persistance", () => {
  it("survit au redémarrage pour un compte interne", async () => {
    setInternalAccount(true);
    await saveInternalGoldPreview(true);
    expect(await loadInternalGoldPreview()).toBe(true);

    // Redémarrage simulé : le module repart à zéro, le store réapplique.
    setInternalAccount(false);
    setInternalAccount(true);
    setInternalGoldPreview(await loadInternalGoldPreview());
    expect(isGoldSpawter(SAMPLE_SPAWTER)).toBe(true);
  });

  it("un disque vide vaut « pas d'aperçu »", async () => {
    expect(await loadInternalGoldPreview()).toBe(false);
  });
});
