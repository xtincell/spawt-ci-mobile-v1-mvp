// Progression — tests du store (progression-store.ts) en mode démo.
// Hydratation, file de célébrations par diff AsyncStorage, toggle max-3
// avec rollback, notifySpawtVerified gated flag, reset.

import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  BADGES_SEEN_KEY,
  CARDS_SEEN_KEY,
  notifySpawtVerified,
  useProgressionStore,
} from "../progression-store";
import { useFeatureFlagsStore } from "../feature-flags";
import {
  SEED_OWNED_CARDS,
  SEED_PAWS_BALANCE,
  SEED_UNLOCKED_BADGES,
} from "../../data/seed/progression";

const SPAWTER_ID = "spawter-test-1";

beforeEach(async () => {
  useProgressionStore.getState().reset();
  useFeatureFlagsStore.setState({ flags: {}, localOverrides: {} });
  await AsyncStorage.clear();
});

describe("progression-store — hydratation (mode démo)", () => {
  it("charge badges, cartes, paws, streak et défis depuis les fixtures", async () => {
    await useProgressionStore.getState().hydrate(SPAWTER_ID);
    const s = useProgressionStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.badges?.catalogue).toHaveLength(32);
    expect(s.badges?.unlocked).toHaveLength(SEED_UNLOCKED_BADGES.length);
    expect(s.cards).toHaveLength(SEED_OWNED_CARDS.length);
    expect(s.pawsBalance).toBe(SEED_PAWS_BALANCE);
    expect(s.pawsLedger.length).toBeGreaterThan(0);
    expect(s.streak?.current_weeks).toBe(3);
    expect(s.challenges).toHaveLength(1);
  });

  it("première hydratation : enregistre les badges vus SANS célébrer", async () => {
    await useProgressionStore.getState().hydrate(SPAWTER_ID);
    expect(useProgressionStore.getState().pendingBadgeCelebrations).toEqual([]);
    const raw = await AsyncStorage.getItem(BADGES_SEEN_KEY);
    expect(JSON.parse(raw ?? "[]")).toHaveLength(SEED_UNLOCKED_BADGES.length);
  });

  it("badge apparu depuis la dernière visite → file de célébration", async () => {
    // État connu : tous les badges démo SAUF le premier.
    const known = SEED_UNLOCKED_BADGES.slice(1).map((b) => b.badge_code);
    await AsyncStorage.setItem(BADGES_SEEN_KEY, JSON.stringify(known));
    await useProgressionStore.getState().hydrate(SPAWTER_ID);
    expect(useProgressionStore.getState().pendingBadgeCelebrations).toEqual([
      SEED_UNLOCKED_BADGES[0]!.badge_code,
    ]);
    // Le set persistant est complété (pas de re-célébration au prochain run).
    const raw = await AsyncStorage.getItem(BADGES_SEEN_KEY);
    expect(JSON.parse(raw ?? "[]")).toHaveLength(SEED_UNLOCKED_BADGES.length);
  });

  it("nouvelle carte depuis la dernière visite → toast (une seule à la fois)", async () => {
    await AsyncStorage.setItem(
      CARDS_SEEN_KEY,
      JSON.stringify([SEED_OWNED_CARDS[1]!.code, SEED_OWNED_CARDS[2]!.code]),
    );
    await useProgressionStore.getState().hydrate(SPAWTER_ID);
    expect(useProgressionStore.getState().pendingCardToast?.code).toBe(
      SEED_OWNED_CARDS[0]!.code,
    );
  });

  it("consumeBadgeCelebration dépile en FIFO", async () => {
    useProgressionStore.setState({ pendingBadgeCelebrations: ["a", "b"] });
    useProgressionStore.getState().consumeBadgeCelebration();
    expect(useProgressionStore.getState().pendingBadgeCelebrations).toEqual(["b"]);
  });
});

describe("progression-store — toggle « afficher sur mon profil »", () => {
  beforeEach(async () => {
    await useProgressionStore.getState().hydrate(SPAWTER_ID);
  });

  it("retirer puis remettre un badge affiché → ok (mode démo)", async () => {
    const displayed = SEED_UNLOCKED_BADGES.find((b) => b.is_displayed)!;
    const off = await useProgressionStore
      .getState()
      .toggleBadgeDisplayed(displayed.badge_code);
    expect(off).toBe("ok");
    const row = useProgressionStore
      .getState()
      .badges?.unlocked.find((b) => b.badge_code === displayed.badge_code);
    expect(row?.is_displayed).toBe(false);
  });

  it("4e badge affiché → 'max' (garde client, invariant DB miroité)", async () => {
    // Les fixtures ont déjà 3 badges affichés — en épingler un 4e doit refuser.
    const hidden = SEED_UNLOCKED_BADGES.find((b) => !b.is_displayed)!;
    const result = await useProgressionStore
      .getState()
      .toggleBadgeDisplayed(hidden.badge_code);
    expect(result).toBe("max");
  });

  it("badge non débloqué → 'error'", async () => {
    const result = await useProgressionStore
      .getState()
      .toggleBadgeDisplayed("murmure_urbain");
    expect(result).toBe("error");
  });
});

describe("notifySpawtVerified — gate flag badges-v2", () => {
  it("flag off (défaut) → aucun badge-check déclenché", async () => {
    await notifySpawtVerified(SPAWTER_ID);
    // En mode démo, runBadgeCheck rechargerait le snapshot badges — resté null.
    expect(useProgressionStore.getState().badges).toBeNull();
  });

  it("flag on → runBadgeCheck rafraîchit le snapshot badges", async () => {
    useFeatureFlagsStore.setState({ flags: { "badges-v2": true } });
    await notifySpawtVerified(SPAWTER_ID);
    expect(useProgressionStore.getState().badges?.catalogue).toHaveLength(32);
  });
});

describe("progression-store — reset", () => {
  it("revient à l'état vierge (changement de compte)", async () => {
    await useProgressionStore.getState().hydrate(SPAWTER_ID);
    useProgressionStore.getState().reset();
    const s = useProgressionStore.getState();
    expect(s.hydrated).toBe(false);
    expect(s.badges).toBeNull();
    expect(s.cards).toEqual([]);
    expect(s.pawsBalance).toBeNull();
    expect(s.pendingBadgeCelebrations).toEqual([]);
  });
});
