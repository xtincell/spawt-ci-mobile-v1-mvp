// Store Zustand Progression — badges 30+, cartes, paws, streak, défis.
// Hydraté à la demande (écran Progression, teaser du profil) via l'adaptateur
// data-source (démo = fixtures, live = Supabase 0035-0037/0040).
//
// Célébrations : la file `pendingBadgeCelebrations` est alimentée par DIFF
// entre l'état connu (AsyncStorage `spawt:progression:badges_seen`) et le
// snapshot frais — robuste au fait que les badges sont attribués côté SQL par
// trigger (le RPC peut retourner [] alors qu'un badge vient d'apparaître).
// Première hydratation (aucun set connu) : on ENREGISTRE sans célébrer, pour
// ne pas faire pleuvoir 7 overlays sur un compte existant. Même logique pour
// les cartes (toast Chat sobre, une carte à la fois).

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getMyStreak,
  getPawsBalance,
  listActiveChallenges,
  listBadges,
  listPawsLedger,
  listSpawterCards,
  setBadgeDisplayed,
  triggerBadgeCheck,
} from "../lib/data-source";
import type {
  ActiveChallenge,
  BadgeSnapshot,
  OwnedCard,
  PawsLedgerEntry,
  SpawterStreak,
} from "../types/progression";
import { useFeatureFlagsStore } from "./feature-flags";

/** Clés AsyncStorage (purgées par spawter-store.reset — fuite cross-user sinon). */
export const BADGES_SEEN_KEY = "spawt:progression:badges_seen";
export const CARDS_SEEN_KEY = "spawt:progression:cards_seen";

async function loadSeenSet(key: string): Promise<Set<string> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return null;
  }
}

async function saveSeenSet(key: string, codes: Iterable<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify([...codes]));
  } catch (err) {
    if (__DEV__) console.warn("[progression-store] saveSeenSet failed", err);
  }
}

interface ProgressionStore {
  /** Spawter dont l'état est chargé — un changement de compte re-hydrate. */
  spawterId: string | null;
  hydrated: boolean;
  loading: boolean;
  badges: BadgeSnapshot | null;
  cards: OwnedCard[];
  pawsBalance: number | null;
  pawsLedger: PawsLedgerEntry[];
  streak: SpawterStreak | null;
  challenges: ActiveChallenge[];
  /** Codes de badges en attente de célébration (overlay root, FIFO). */
  pendingBadgeCelebrations: string[];
  /** Nouvelle carte en attente de toast Chat (une à la fois, sobre). */
  pendingCardToast: OwnedCard | null;

  /** Charge tout en parallèle + diff célébrations. Idempotent par spawter. */
  hydrate: (spawter_id: string) => Promise<void>;
  /** RPC `check_and_award_badges` + refresh badges + enqueue des nouveaux. */
  runBadgeCheck: (spawter_id: string) => Promise<void>;
  /**
   * Toggle « afficher sur mon profil » — garde max-3 côté client AVANT le
   * serveur (feedback immédiat), rollback si le serveur refuse.
   */
  toggleBadgeDisplayed: (badge_code: string) => Promise<"ok" | "max" | "error">;
  /** Acquitte la célébration en tête de file (l'overlay montre la suivante). */
  consumeBadgeCelebration: () => void;
  /** Acquitte le toast carte. */
  consumeCardToast: () => void;
  reset: () => void;
}

// Guards in-flight module-level (mêmes doctrines que refreshGold) : hydrate et
// badge-check peuvent être déclenchés en rafale (profil + écran + spawt).
let __hydrateInFlight: Promise<void> | null = null;
let __badgeCheckInFlight: Promise<void> | null = null;

export const useProgressionStore = create<ProgressionStore>((set, get) => ({
  spawterId: null,
  hydrated: false,
  loading: false,
  badges: null,
  cards: [],
  pawsBalance: null,
  pawsLedger: [],
  streak: null,
  challenges: [],
  pendingBadgeCelebrations: [],
  pendingCardToast: null,

  hydrate: async (spawter_id) => {
    // Changement de compte : repartir d'un état vierge avant de charger.
    if (get().spawterId && get().spawterId !== spawter_id) get().reset();
    if (__hydrateInFlight) return __hydrateInFlight;
    __hydrateInFlight = (async () => {
      try {
        set({ loading: true, spawterId: spawter_id });
        const [badges, cards, pawsBalance, pawsLedger, streak, challenges] =
          await Promise.all([
            listBadges(spawter_id),
            listSpawterCards(spawter_id),
            getPawsBalance(spawter_id),
            listPawsLedger(spawter_id),
            getMyStreak(spawter_id),
            listActiveChallenges(),
          ]);

        // ── Diff badges → file de célébrations ──────────────────────────────
        const freshCodes = badges.unlocked.map((b) => b.badge_code);
        const seenBadges = await loadSeenSet(BADGES_SEEN_KEY);
        let pendingBadgeCelebrations = get().pendingBadgeCelebrations;
        if (seenBadges === null) {
          // Première fois : on enregistre sans célébrer (compte existant).
          await saveSeenSet(BADGES_SEEN_KEY, freshCodes);
        } else {
          const news = freshCodes.filter((c) => !seenBadges.has(c));
          if (news.length > 0) {
            pendingBadgeCelebrations = [
              ...pendingBadgeCelebrations,
              ...news.filter((c) => !pendingBadgeCelebrations.includes(c)),
            ];
            await saveSeenSet(BADGES_SEEN_KEY, [...seenBadges, ...news]);
          }
        }

        // ── Diff cartes → toast Chat (une à la fois) ────────────────────────
        const freshCardCodes = cards.map((c) => c.code);
        const seenCards = await loadSeenSet(CARDS_SEEN_KEY);
        let pendingCardToast = get().pendingCardToast;
        if (seenCards === null) {
          await saveSeenSet(CARDS_SEEN_KEY, freshCardCodes);
        } else {
          const newCard = cards.find((c) => !seenCards.has(c.code));
          if (newCard) {
            pendingCardToast = pendingCardToast ?? newCard;
            await saveSeenSet(CARDS_SEEN_KEY, [...seenCards, ...freshCardCodes]);
          }
        }

        set({
          badges,
          cards,
          pawsBalance: pawsBalance ?? get().pawsBalance,
          pawsLedger,
          streak,
          challenges,
          pendingBadgeCelebrations,
          pendingCardToast,
          hydrated: true,
          loading: false,
        });
      } catch (err) {
        if (__DEV__) console.warn("[progression-store] hydrate failed", err);
        set({ loading: false });
      } finally {
        __hydrateInFlight = null;
      }
    })();
    return __hydrateInFlight;
  },

  runBadgeCheck: async (spawter_id) => {
    if (__badgeCheckInFlight) return __badgeCheckInFlight;
    __badgeCheckInFlight = (async () => {
      try {
        // Le RPC retourne les codes tout juste gagnés ; le refresh derrière
        // rattrape aussi ceux attribués par trigger SQL entre-temps (diff).
        const newCodes = await triggerBadgeCheck(spawter_id);
        if (newCodes.length > 0) {
          const seen = (await loadSeenSet(BADGES_SEEN_KEY)) ?? new Set<string>();
          const pending = get().pendingBadgeCelebrations;
          const toAdd = newCodes.filter((c) => !seen.has(c) && !pending.includes(c));
          if (toAdd.length > 0) {
            set({ pendingBadgeCelebrations: [...pending, ...toAdd] });
            await saveSeenSet(BADGES_SEEN_KEY, [...seen, ...toAdd]);
          }
        }
        // Refresh du snapshot badges (état is_displayed/unlocked_at à jour).
        const badges = await listBadges(spawter_id);
        set({ badges });
      } catch (err) {
        if (__DEV__) console.warn("[progression-store] runBadgeCheck failed", err);
      } finally {
        __badgeCheckInFlight = null;
      }
    })();
    return __badgeCheckInFlight;
  },

  toggleBadgeDisplayed: async (badge_code) => {
    const { badges, spawterId } = get();
    if (!badges || !spawterId) return "error";
    const target = badges.unlocked.find((b) => b.badge_code === badge_code);
    if (!target) return "error"; // pas débloqué → pas affichable
    const next = !target.is_displayed;

    // Garde max-3 client AVANT le serveur — feedback immédiat, même en démo.
    if (next) {
      const displayedCount = badges.unlocked.filter(
        (b) => b.is_displayed && b.badge_code !== badge_code,
      ).length;
      if (displayedCount >= 3) return "max";
    }

    // Optimiste local-first, rollback si le serveur refuse.
    const apply = (value: boolean): BadgeSnapshot => ({
      catalogue: badges.catalogue,
      unlocked: badges.unlocked.map((b) =>
        b.badge_code === badge_code ? { ...b, is_displayed: value } : b,
      ),
    });
    set({ badges: apply(next) });
    const result = await setBadgeDisplayed(spawterId, badge_code, next);
    if (result !== "ok") {
      set({ badges: apply(target.is_displayed) });
    }
    return result;
  },

  consumeBadgeCelebration: () => {
    set({ pendingBadgeCelebrations: get().pendingBadgeCelebrations.slice(1) });
  },

  consumeCardToast: () => {
    set({ pendingCardToast: null });
  },

  reset: () => {
    set({
      spawterId: null,
      hydrated: false,
      loading: false,
      badges: null,
      cards: [],
      pawsBalance: null,
      pawsLedger: [],
      streak: null,
      challenges: [],
      pendingBadgeCelebrations: [],
      pendingCardToast: null,
    });
  },
}));

/**
 * Hook post-spawt-vérifié (appelé par spawter-store.registerSpawt et le flux
 * d'avis, en fire-and-forget) : si le flag `badges-v2` est actif, déclenche
 * l'évaluation serveur des badges — best-effort, jamais bloquant, jamais
 * d'exception qui remonte au flux du spawt.
 */
export async function notifySpawtVerified(spawter_id: string): Promise<void> {
  try {
    const flags = useFeatureFlagsStore.getState().flags;
    if (!flags["badges-v2"]) return;
    await useProgressionStore.getState().runBadgeCheck(spawter_id);
  } catch (err) {
    if (__DEV__) console.warn("[progression-store] notifySpawtVerified failed", err);
  }
}
