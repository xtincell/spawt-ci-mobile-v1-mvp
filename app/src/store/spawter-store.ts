// Store Zustand pour le spawter actif + son Palais + ses spawts locaux.
// Persiste via AsyncStorage. Synchronise vers Supabase si configuré.

import { create } from "zustand";

import type { Spawter, OnboardingDraft } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { PlaceAdn } from "../types/place";
import type { SpawtCheckin, ReviewTag } from "../types/spawt";
import type { CalibrationDelta } from "../types/palais";
import type { CollectionTitreRow } from "../types/collection-titres";

import {
  loadSpawter,
  loadPalais,
  loadSpawts,
  saveSpawterLocal,
  savePalaisLocal,
  saveRecoveredAccountLocal,
  appendSpawtLocal,
  setConsent as setConsentLocal,
  loadCollectionTitres,
  saveCollectionTitresLocal,
} from "../lib/storage";
import {
  saveSpawter,
  savePalais,
  isSupabaseConfigured,
  upsertProgression,
  insertTitre,
  setDisplayedTitre,
  updateSpawterArchetype,
  fetchSpawterArchetype,
  fetchSpawterInternal,
  claimMeuteHeritage,
  fetchGoldEntitlement,
  type GoldEntitlement,
} from "../lib/data-source";
import { loadSavedPlaces, toggleSavedPlace, syncSavedPlaces, purgeSavedPlaces, SavedPlacesCacheError } from "../lib/saved-places";
import { applyMeuteHeritage, initialMeutePalais } from "../lib/meute-heritage";
// Sprint 2 Gold — cache module synchrone (isGoldSpawter) + persistance locale.
import {
  GOLD_STORAGE_KEY,
  INTERNAL_GOLD_KEY,
  loadGoldLocal,
  loadInternalGoldPreview,
  saveGoldLocal,
  setGoldEntitlementState,
  setInternalAccount,
  setInternalGoldPreview,
} from "../lib/spawter-gold";
import { AppState } from "react-native";
import {
  computeArchetypeFromPalais,
  isArchetypeKey,
} from "../lib/archetype-engine";
import {
  evaluateArchetypeTransition,
  loadMueStreak,
  saveMueStreak,
  loadPendingMue,
  savePendingMue,
  MUE_STREAK_STORAGE_KEY,
  PENDING_MUE_STORAGE_KEY,
  type PendingMue,
} from "../lib/archetype-mue";
import { ARCHETYPES } from "../data/archetypes";
import {
  isKnownTitleKey,
  STADE_TITLE_KEYS,
  STADE_ORDER,
  PREMIER_SPAWT_TITLE_KEY,
  stadeTitleKeysBetween,
  type TitleSource,
} from "../lib/titres-catalogue";
import { enqueue, saveSpawtToSupabaseOrEnqueue } from "../lib/offline-queue";
import { applyReviewToPalais } from "../lib/palais-signals";
import { ageRangeFromDateOfBirth } from "../lib/age-range";
import { recomputeAndPersistPlaceAdn } from "../lib/place-adn-update";
import { supabase } from "../lib/supabase";
import { canResumeMissingPalais, readAuthenticatedAccount, requireAccountSession } from "../lib/account-recovery";
import { dominantAxes } from "../lib/palais-engine";
import { getStade, maxStade } from "../types/stade";
import { EMPTY_PALAIS, SAMPLE_SPAWTER } from "../data/seed/sample-spawter";
import { useOnboardingDraft } from "./onboarding-draft";
// Progression — évaluation serveur des badges après spawt vérifié (RPC
// check_and_award_badges, gated flag badges-v2 dans notifySpawtVerified) +
// purge des clés « déjà vu » et reset du store au changement de compte.
import {
  BADGES_SEEN_KEY,
  CARDS_SEEN_KEY,
  notifySpawtVerified,
  useProgressionStore,
} from "./progression-store";
// Cycle runtime-only (crew-store importe spawter-store, usage réciproque
// uniquement dans les actions) — utilisé par reset() pour purger le Crew (P2#7).
import { useCrewStore } from "./crew-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { track } from "../lib/analytics";

let __idCounter = 0;
function makeId(): string {
  __idCounter += 1;
  try {
    const v = (Crypto as { randomUUID?: () => string }).randomUUID?.();
    if (typeof v === "string" && v.length > 8) return v;
  } catch {
    // jest-expo peut ne pas stuber randomUUID — fallthrough vers le générateur local.
  }
  return `loc-${Date.now()}-${__idCounter}-${Math.random().toString(36).slice(2, 10)}`;
}

const BADGE_CELEBRATED_KEY = "spawt:badge:premier_spawt_celebrated";

/**
 * CR Chunk A finding M7 — Guard in-flight contre double célébration de stade.
 * Deux registerSpawt concurrents (double-tap, race async) peuvent computer
 * la même montée et tomber tous les deux dans le `if (!alreadyCelebrated)`
 * avant que `consumePendingStadeCelebration` n'ait posé le flag persistant.
 * On ajoute un Set module-level synchrone qui agit comme verrou avant le set
 * et qu'on libère uniquement quand le flag persistant est posé.
 */
const __celebrationInFlight: Set<import("../types/stade").Stade> = new Set();

// Sprint 2 Gold — guard in-flight : hydrate, foreground et paywall peuvent
// déclencher refreshGold en rafale, on ne fait qu'une requête à la fois.
let __goldRefreshInFlight: Promise<void> | null = null;

// Sprint 2 Gold — listener foreground unique (module-level, jamais retiré :
// même cycle de vie que celui d'analytics.ts). Au retour en avant-plan, on
// revalide le droit — un abonnement pris sur le portail web pendant que
// l'app était en arrière-plan devient visible sans relancer l'app.
let __goldAppStateWired = false;
function ensureGoldForegroundRefresh(): void {
  if (__goldAppStateWired) return;
  __goldAppStateWired = true;
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void useSpawterStore
        .getState()
        .refreshGold()
        .catch((err) => {
          if (__DEV__) console.warn("[spawter-store] gold foreground refresh failed", err);
        });
      void useSpawterStore.getState().refreshSaved().catch((err) => {
        if (__DEV__) console.warn("[spawter-store] saved foreground sync failed", err);
      });
    }
  });
}

interface PendingBadge {
  place_id: string;
  place_name?: string;
}

interface SpawterStore {
  /** true tant que loadAll n'a pas terminé (boot de l'app) */
  hydrating: boolean;
  spawter: Spawter | null;
  palais: UserPalais | null;
  spawts: SpawtCheckin[];
  /** Story 3.6 — Set d'IDs des lieux sauvegardés. Toujours présent (vide = pas de favoris). */
  savedPlaceIds: Set<string>;
  savedUnavailable: boolean;
  /** Sprint 2 — entitlement Spawter Gold (cache persisté, revalidé réseau). */
  gold: GoldEntitlement | null;
  /**
   * Sprint 2 — revalide l'entitlement Gold via la vue active_entitlements.
   * Déclencheurs : hydratation, retour foreground, ouverture du paywall.
   * Un résultat indéterminé (réseau) conserve le dernier état connu.
   */
  refreshGold: () => Promise<void>;
  /** Story 4.2 — Badge "Premier Spawt" en attente d'affichage. Consommé par overlay root. */
  pendingBadge: PendingBadge | null;
  /** Story 5.2 — Collection de titres (append-only mémoire d'identité). */
  collectionTitres: CollectionTitreRow[];
  /** Story 5.4 — Montée de stade en attente de célébration (overlay root). */
  pendingStadeCelebration: {
    from_stade: import("../types/stade").Stade;
    to_stade: import("../types/stade").Stade;
    unique_spots: number;
  } | null;
  /** Chantier 13 archétypes — mue en attente de constat NEUTRE (bulle de Chat
   *  sur le profil, PAS un overlay de célébration — exigence PRD §5.5). */
  pendingMue: PendingMue | null;
  /** Acquitte le constat de mue (clear state + AsyncStorage). */
  consumePendingMue: () => Promise<void>;
  /** Story 5.4 — Acquitte la célébration (set flag anti-replay + clear). */
  consumePendingStadeCelebration: () => Promise<void>;
  /** Story 5.2 — Débloque un titre dans la collection (append idempotent). Retourne true si row ajoutée. */
  unlockTitle: (title_key: string, source: TitleSource) => Promise<boolean>;
  /** Story 5.2 — Définit le titre affiché (doit exister dans collection sinon no-op + warn). */
  setDisplayedTitle: (title_key: string) => Promise<void>;
  /** Story 5.2 D5 — Reset au titre par défaut du stade courant (désélectionne le custom). */
  clearDisplayedTitle: () => Promise<void>;
  /** Story 4.2 — Acquitte l'affichage du badge (set flag AsyncStorage set-once + clear). */
  consumePendingBadge: () => Promise<void>;

  hydrate: () => Promise<void>;
  /** Reprendre le profil et le Palais après authentification, sans les réinitialiser. */
  recoverAuthenticatedAccount: (expectedOwner?: string | null, signal?: AbortSignal) => Promise<"new" | "resume" | "restored">;
  /**
   * Story 3.6 — Toggle un place_id dans/hors favoris.
   * Cache et intention persistés ensemble avant affichage ; reprise serveur en arrière-plan.
   * Un échec de stockage rejette sans faux succès ni mutation de l’affichage.
   * Retourne `true` si ajouté, `false` si retiré — utilisé par analytics.
   */
  toggleSaved: (place_id: string) => Promise<boolean>;
  refreshSaved: () => Promise<void>;
  /** Test d'appartenance — synchrone, no I/O. */
  isSaved: (place_id: string) => boolean;
  /**
   * Mode Rapide — applique le signal FAIBLE d'un swipe aux axes du Palais
   * (like = ouverture vers le profil ADN du lieu, pass = léger négatif).
   * Moteur pur : rapide-signals.applySwipeToPalais. Local-first + push
   * Supabase fire-and-forget, même pattern que toggleSaved. No-op silencieux
   * si palais/spawter absents ou ADN trop neutre pour signifier.
   */
  applySwipeSignal: (
    adn: PlaceAdn,
    direction: import("../lib/rapide-signals").SwipeDirection,
  ) => Promise<void>;
  /**
   * Enregistre un consent (CGV ou géoloc).
   *
   * P-26 round 3 — retourne `true` si le consent est nouveau (write effectif),
   * `false` si déjà set (set-once, no-op silencieux). Permet aux callers
   * analytics de différencier les écritures réelles des replays idempotents.
   *
   * **Contrat set-once / ARTCI compliance (DN-4 Round 3, 2026-05-18)** :
   * Un consent posé ne peut pas être révoqué via cette API — le trigger SQL
   * `assert_consent_set_once` rejetterait l'UPDATE. La révocation ARTCI (Loi
   * 2013-450) est exposée via le path `DELETE /me` (soft-delete + anonymisation
   * J+30) tracé Cahier §5.2, à livrer avant ouverture beta publique. Un appel
   * `recordConsent(kind, false)` post-stamp log un `__DEV__` warn et retourne
   * `false` — le caller doit rediriger vers le path DELETE pour un revoke réel.
   * Ne PAS ajouter un `revokeConsent` séparé sans coordonner avec juriste +
   * Stéphanie (l'invariant set-once protège l'auditabilité ARTCI du timestamp).
   */
  recordConsent: (kind: "cgv" | "geoloc", accepted: boolean) => Promise<boolean>;
  /**
   * R27 (build 8) — Met à jour la photo de profil (`avatar_url`, URL publique
   * du bucket `avatars` ou URI locale en mode démo). Local-first + push
   * Supabase fire-and-forget, même pattern que recordConsent.
   */
  updateAvatar: (avatar_url: string) => Promise<void>;
  finalizeOnboarding: (draft: OnboardingDraft) => Promise<void | "restored">;
  registerSpawt: (s: SpawtCheckin) => Promise<void>;
  /**
   * Story 4.5 — Attache un avis structuré à un spawt existant (note + tags + texte + photos).
   * Local-first (AsyncStorage + state), fire-and-forget Supabase via offline-queue wrapper.
   */
  attachReviewToSpawt: (
    spawt_id: string,
    patch: {
      note_etoiles: 1 | 2 | 3 | 4 | 5;
      texte_avis: string | null;
      tags: ReviewTag[];
      photos: string[];
    },
  ) => Promise<void>;
  reset: () => void;
}

const STADE_CELEBRATED_KEY = "spawt:stade:celebrated";

/**
 * Écrit le compte côté serveur, et en cas d'échec le confie à la file de
 * reprise plutôt que de se contenter d'un avertissement.
 *
 * Les trois appels d'origine étaient `void saveSpawter(x).catch(warn)` : un
 * échec réseau au moment du consentement laissait un compte qui vit sur le
 * téléphone et n'existe nulle part en base, sans le moindre signal. Ses spawts
 * partaient ensuite vers un `spawter_id` inconnu et échouaient en cascade sur
 * la clé étrangère — un compte durablement cassé, né d'une coupure de réseau
 * de trois secondes.
 */
async function persistSpawterFiable(spawter: Spawter): Promise<void> {
  try {
    await saveSpawter(spawter);
  } catch (err) {
    if (__DEV__) console.warn("[spawter-store] saveSpawter échoué — mis en file", err);
    try {
      await enqueue({ kind: "spawter_upsert", row: spawter });
    } catch (qerr) {
      if (__DEV__) console.warn("[spawter-store] mise en file impossible", qerr);
    }
  }
}

let sessionGeneration = 0;
let resetPending: Promise<unknown> = Promise.resolve();
let accountStorageTail: Promise<unknown> = Promise.resolve();
function withAccountStorage<T>(action: () => Promise<T>): Promise<T> {
  const result = accountStorageTail.then(action);
  accountStorageTail = result.catch(() => undefined);
  return result;
}

export const useSpawterStore = create<SpawterStore>((set, get) => ({
  hydrating: true,
  spawter: null,
  palais: null,
  spawts: [],
  savedPlaceIds: new Set(),
  savedUnavailable: false,
  gold: null,
  pendingBadge: null,
  collectionTitres: [],
  pendingStadeCelebration: null,
  pendingMue: null,

  consumePendingMue: async () => {
    if (!get().pendingMue) return;
    // Clear AsyncStorage AVANT le state (même philosophie que les autres
    // consume* : un crash entre les deux ne doit pas rejouer le constat).
    await savePendingMue(null);
    set({ pendingMue: null });
  },

  consumePendingBadge: async () => {
    // CR finding M3 — POSE LE FLAG ANTI-REPLAY AVANT `set(null)` pour qu'un
    // crash entre les deux ne supprime pas la trace serveur du badge déjà célébré.
    try {
      await AsyncStorage.setItem(BADGE_CELEBRATED_KEY, new Date().toISOString());
    } catch (err) {
      if (__DEV__) console.warn("[spawter-store] consumePendingBadge flag write failed", err);
    }
    // Attend l'unlock titre Premier Spawt AVANT clear (M3+M9 — sinon un unmount
    // entre les deux peut perdre la row collection_titres correspondante).
    try {
      await get().unlockTitle(PREMIER_SPAWT_TITLE_KEY, "badge");
    } catch (err) {
      if (__DEV__) console.warn("[spawter-store] unlockTitle badge failed", err);
    }
    set({ pendingBadge: null });
  },

  consumePendingStadeCelebration: async () => {
    const pending = get().pendingStadeCelebration;
    if (!pending) return;
    // CR finding M3 + M7 — flag posé AVANT clear state, in-flight libéré APRÈS
    // le flag persistant (sinon un nouveau registerSpawt sur le même stade
    // pourrait rouvrir une célébration entre clear-state et flag-write).
    try {
      await AsyncStorage.setItem(
        `${STADE_CELEBRATED_KEY}:${pending.to_stade}`,
        new Date().toISOString(),
      );
    } catch (err) {
      if (__DEV__) console.warn("[spawter-store] stade celebration flag write failed", err);
    }
    __celebrationInFlight.delete(pending.to_stade);
    set({ pendingStadeCelebration: null });
  },

  unlockTitle: async (title_key, source) => {
    const spawter = get().spawter;
    if (!spawter) {
      if (__DEV__) console.warn("[spawter-store] unlockTitle no spawter — skip");
      return false;
    }
    if (!isKnownTitleKey(title_key)) {
      if (__DEV__) console.warn("[spawter-store] unlockTitle unknown key — skip", title_key);
      return false;
    }
    const current = get().collectionTitres;
    if (current.some((r) => r.title_key === title_key && r.spawter_id === spawter.id)) {
      return false; // idempotent
    }
    const row: CollectionTitreRow = {
      id: makeId(),
      spawter_id: spawter.id,
      title_key,
      source,
      is_displayed: false,
      unlocked_at: new Date().toISOString(),
    };
    const next = [...current, row];
    await saveCollectionTitresLocal(next);
    void insertTitre(row).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] insertTitre failed", err);
    });
    set({ collectionTitres: next });
    return true;
  },

  setDisplayedTitle: async (title_key) => {
    const spawter = get().spawter;
    if (!spawter) {
      if (__DEV__) console.warn("[spawter-store] setDisplayedTitle no spawter — skip");
      return;
    }
    const list = get().collectionTitres;
    const target = list.find(
      (r) => r.title_key === title_key && r.spawter_id === spawter.id,
    );
    if (!target) {
      if (__DEV__) console.warn("[spawter-store] setDisplayedTitle title not unlocked", title_key);
      return;
    }
    const fromKey = list.find((r) => r.is_displayed)?.title_key ?? null;
    if (fromKey === title_key) return; // no-op si déjà displayed
    const updated = list.map((r) => ({ ...r, is_displayed: r.id === target.id }));
    await saveCollectionTitresLocal(updated);
    // CR finding D1 — appel RPC atomique côté Supabase (migration 0022 set_displayed_title
    // remplace l'ancien 2-step UPDATE non-atomique qui pouvait laisser le serveur
    // dans l'état "0 titre affiché" sur partial fail).
    void setDisplayedTitre(spawter.id, title_key).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] setDisplayedTitre failed", err);
    });
    set({ collectionTitres: updated });
    track({
      name: "title_displayed_changed",
      properties: { from: fromKey, to: title_key },
    });
  },

  clearDisplayedTitle: async () => {
    const spawter = get().spawter;
    if (!spawter) return;
    const list = get().collectionTitres;
    const fromRow = list.find((r) => r.is_displayed);
    if (!fromRow) return; // déjà clear, no-op
    const updated = list.map((r) => ({ ...r, is_displayed: false }));
    await saveCollectionTitresLocal(updated);
    // Côté serveur : on bascule sur le titre par défaut du stade actuel via RPC
    // (set_displayed_title accepte n'importe quel titre déjà dans la collection
    // donc le titre stade-courant unlock par registerSpawt fait l'affaire).
    // Si le titre stade-courant n'est pas dans la collection (cas edge si user
    // efface sa collection), le RPC retourne erreur silencieuse — local prime.
    const defaultKey = STADE_TITLE_KEYS[spawter.stade];
    void setDisplayedTitre(spawter.id, defaultKey).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] clearDisplayedTitle reset failed", err);
    });
    set({ collectionTitres: updated });
    track({
      name: "title_displayed_changed",
      properties: { from: fromRow.title_key, to: null },
    });
  },

  refreshGold: async () => {
    const generation = sessionGeneration;
    const owner = get().spawter?.id;
    const isCurrent = () => generation === sessionGeneration && get().spawter?.id === owner;
    if (__goldRefreshInFlight) return __goldRefreshInFlight;
    const flight: Promise<void> = Promise.resolve().then(async () => {
      try {
        const fresh = await fetchGoldEntitlement();
        // `null` = indéterminé (réseau/erreur) : on GARDE le dernier état
        // connu — on ne dégrade jamais un droit sur un échec transitoire.
        if (fresh === null || !isCurrent()) return;
        await withAccountStorage(async () => {
          if (!isCurrent()) return;
          await saveGoldLocal(fresh);
          if (isCurrent()) {
            setGoldEntitlementState(fresh);
            set({ gold: fresh });
          }
        });
      } catch (err) {
        if (__DEV__) console.warn("[spawter-store] refreshGold failed", err);
      } finally {
        if (__goldRefreshInFlight === flight) __goldRefreshInFlight = null;
      }
    });
    __goldRefreshInFlight = flight;
    return flight;
  },

  hydrate: async () => {
    const generation = sessionGeneration;
    await resetPending;
    const [spawter, cachedPalais, spawts, collectionTitres, pendingMue] =
      await Promise.all([
        loadSpawter(),
        loadPalais(),
        loadSpawts(),
        loadCollectionTitres(),
        loadPendingMue(),
      ]);
    if (generation !== sessionGeneration) return;
    const palais = spawter && cachedPalais?.spawter_id === spawter.id ? cachedPalais : null;
    let savedPlaceIds = new Set<string>();
    let savedUnavailable = false;
    try { savedPlaceIds = await loadSavedPlaces(spawter?.id ?? null); }
    catch (err) {
      savedUnavailable = true;
      if (__DEV__) console.warn("[spawter-store] saved cache unavailable", err);
    }
    if (generation !== sessionGeneration) return;
    const isCurrent = () => generation === sessionGeneration && get().spawter?.id === spawter?.id;
    set({ spawter, palais, spawts, savedPlaceIds, savedUnavailable, collectionTitres, pendingMue, hydrating: false });

    // Sprint 2 Gold — cache local d'abord (offline-first : le badge doré ne
    // clignote pas au boot), puis revalidation réseau fire-and-forget +
    // armement du refresh au retour foreground. Jamais bloquant.
    void (async () => {
      const cachedGold = await loadGoldLocal();
      if (!isCurrent()) return;
      if (cachedGold) {
        setGoldEntitlementState(cachedGold);
        set({ gold: cachedGold });
      }
      ensureGoldForegroundRefresh();
      await get().refreshGold();
    })().catch((err) => {
      if (__DEV__) console.warn("[spawter-store] gold hydrate failed", err);
    });

    // Comptes internes (0060) — le statut est REVALIDÉ à chaque hydratation,
    // pas seulement à la première : un retrait décidé depuis la console admin
    // doit refermer le menu au prochain lancement. La bascule Gold locale n'est
    // restaurée qu'ensuite, et seulement si le statut tient toujours — sinon
    // un compte déchu garderait un aperçu Gold que plus rien ne justifie.
    if (spawter) {
      void (async () => {
        const remote = await fetchSpawterInternal(spawter.id);
        if (!isCurrent()) return;
        const isInternal = remote ?? spawter.is_internal;
        setInternalAccount(isInternal);
        if (isInternal) {
          const preview = await loadInternalGoldPreview();
          if (!isCurrent()) return;
          setInternalGoldPreview(preview);
        }
        const cur = get().spawter;
        if (cur && cur.is_internal !== isInternal) {
          const updated: Spawter = { ...cur, is_internal: isInternal };
          await withAccountStorage(async () => {
            if (!isCurrent()) return;
            await saveSpawterLocal(updated);
            if (isCurrent()) set({ spawter: updated });
          });
        }
      })().catch((err) => {
        if (__DEV__) console.warn("[spawter-store] internal status refresh failed", err);
      });
    }

    // Chantier 13 archétypes — rattrapage live : si le local n'a pas
    // d'archétype (row pré-chantier, réinstallation) mais que `spawters` en a
    // un (héritage réclamé server-side via claim_meute_heritage, ou recalc
    // d'un autre device), on l'adopte. Fire-and-forget, jamais bloquant.
    if (spawter && isSupabaseConfigured && !spawter.quiz_archetype) {
      void (async () => {
        const remote = await fetchSpawterArchetype(spawter.id);
        if (!isCurrent() || !remote || !isArchetypeKey(remote.quiz_archetype)) return;
        const cur = get().spawter;
        if (!cur || cur.quiz_archetype) return; // le local a avancé entretemps
        const updated: Spawter = {
          ...cur,
          quiz_archetype: remote.quiz_archetype,
          pionnier_seq: remote.pionnier_seq ?? cur.pionnier_seq ?? null,
        };
        await withAccountStorage(async () => {
          if (!isCurrent()) return;
          await saveSpawterLocal(updated);
          if (isCurrent()) set({ spawter: updated });
        });
      })().catch((err) => {
        if (__DEV__) console.warn("[spawter-store] archetype remote adopt failed", err);
      });
    }

    void get().refreshSaved().catch((err) => {
      if (__DEV__) console.warn("[spawter-store] saved sync failed", err);
    });
  },

  recoverAuthenticatedAccount: async (expectedOwner, signal) => {
    const initialGeneration = sessionGeneration;
    const account = await readAuthenticatedAccount(expectedOwner, signal);
    if (signal?.aborted || sessionGeneration !== initialGeneration) throw new Error("ACCOUNT_SESSION_CHANGED");
    if (account.kind === "new") return "new";
    if (canResumeMissingPalais(account)) {
      const source = account.spawter;
      const draft = useOnboardingDraft.getState();
      draft.setField("display_name", source.display_name);
      draft.setField("neighborhood", source.neighborhood ?? "");
      draft.setField("country_code", source.country_code);
      draft.setField("origin_country_code", source.origin_country_code);
      draft.setField("gender", source.gender);
      draft.setField("date_of_birth", source.date_of_birth);
      draft.setField("consent", {
        cgv_accepted_at: source.cgv_accepted_at ?? draft.draft.consent.cgv_accepted_at,
        geoloc_consent_at: source.geoloc_consent_at ?? draft.draft.consent.geoloc_consent_at,
      });
      return "resume";
    }
    if (account.kind === "incomplete") throw new Error("ACCOUNT_INCOMPLETE");
    // Le cache local d'une autre installation/personne n'est pas un héritage.
    // Le reset existant invalide aussi les réponses Gold, favoris et rôles tardives.
    await requireAccountSession(account.owner);
    if (signal?.aborted || sessionGeneration !== initialGeneration) throw new Error("ACCOUNT_SESSION_CHANGED");
    get().reset();
    const generation = sessionGeneration;
    const isCurrent = () => generation === sessionGeneration && !signal?.aborted;
    await resetPending;
    await withAccountStorage(async () => {
      if (!isCurrent()) throw new Error("ACCOUNT_SESSION_CHANGED");
      await requireAccountSession(account.owner);
      await saveRecoveredAccountLocal(account.spawter, account.palais, isCurrent);
      try {
        await requireAccountSession(account.owner);
      } catch (error) {
        if (isCurrent()) get().reset();
        throw error;
      }
      if (!isCurrent()) throw new Error("ACCOUNT_SESSION_CHANGED");
      set({ spawter: account.spawter, palais: account.palais, hydrating: false });
    });
    useOnboardingDraft.getState().reset();
    // Favoris et droits utilisent leurs mécanismes de reprise existants.
    void get().hydrate().catch((err) => {
      if (__DEV__) console.warn("[spawter-store] recovered cache hydrate failed", err);
    });
    return "restored";
  },

  refreshSaved: async () => {
    const owner = get().spawter?.id;
    if (!owner) return;
    const generation = sessionGeneration;
    const isCurrent = () => generation === sessionGeneration && get().spawter?.id === owner;
    try {
      await syncSavedPlaces(owner, generation, isCurrent, (ids) => set({ savedPlaceIds: ids, savedUnavailable: false }));
      if (isCurrent()) set({ savedUnavailable: false });
    } catch (err) {
      if (isCurrent() && err instanceof SavedPlacesCacheError) set({ savedUnavailable: true });
      throw err;
    }
  },

  toggleSaved: async (place_id: string) => {
    const generation = sessionGeneration;
    const owner = get().spawter?.id ?? null;
    const isCurrent = () => generation === sessionGeneration && (get().spawter?.id ?? null) === owner;
    await resetPending;
    const added = await toggleSavedPlace(owner, place_id, () => get().savedPlaceIds,
      isCurrent, (ids) => set({ savedPlaceIds: ids }));
    void get().refreshSaved().catch((err) => {
      if (__DEV__) console.warn("[spawter-store] saved sync pending", err);
    });
    return added;
  },

  isSaved: (place_id: string) => get().savedPlaceIds.has(place_id),

  applySwipeSignal: async (adn, direction) => {
    const palais = get().palais;
    const spawter = get().spawter;
    if (!palais || !spawter) return;
    // Import dynamique — le moteur swipe n'est chargé que si le Mode Rapide
    // est réellement utilisé (flag `mode-rapide` OFF par défaut).
    const { applySwipeToPalais } = await import("../lib/rapide-signals");
    const { palais: next, didUpdate } = applySwipeToPalais({
      current: palais,
      unique_spots: spawter.unique_spots,
      adn,
      direction,
    });
    if (!didUpdate) return;
    // Local-first : commit AsyncStorage AVANT le state (même invariant que
    // toggleSaved — pas de divergence state/disque au prochain hydrate).
    await savePalaisLocal(next);
    void savePalais(next).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] savePalais swipe failed", err);
    });
    set({ palais: next });
  },

  recordConsent: async (kind, accepted) => {
    await setConsentLocal(kind, accepted);
    const current = get().spawter;
    if (current) {
      const fieldName = kind === "geoloc" ? "geoloc_consent_at" : "cgv_accepted_at";
      // P19 — set-once : si le timestamp est déjà posé en DB, ne pas
      // re-stamper (le trigger SQL `assert_consent_set_once` rejetterait).
      if (current[fieldName]) {
        // P-28 — warn DEV explicite si un caller tente un revoke (accepted=false)
        // après que le consent ait été enregistré. Le set-once est un invariant
        // ARTCI (cf. trigger `assert_consent_set_once`) — un revoke client est
        // silencieusement ignoré ici, le caller doit le savoir.
        if (__DEV__ && accepted === false) {
          console.warn(
            `[spawter-store] recordConsent(${kind}, false) ignored — consent is ` +
              `set-once (timestamp ${current[fieldName]}). Revoke not supported.`,
          );
        }
        // P-26 round 3 — signaler le no-op explicite au caller.
        return false;
      }
      const updated: Spawter = {
        ...current,
        [fieldName]: accepted ? new Date().toISOString() : null,
      };
      await saveSpawterLocal(updated);
      // P16 — capture unhandled rejection sur le fire-and-forget Supabase.
      void persistSpawterFiable(updated);
      set({ spawter: updated });
      return true;
    }
    // P-26 round 3 — pas de spawter encore créé → consent stocké local-only
    // via setConsentLocal ci-dessus, considéré comme write effectif.
    return true;
  },

  updateAvatar: async (avatar_url) => {
    const current = get().spawter;
    if (!current) return;
    const updated: Spawter = {
      ...current,
      avatar_url,
      updated_at: new Date().toISOString(),
    };
    await saveSpawterLocal(updated);
    void persistSpawterFiable(updated);
    set({ spawter: updated });
  },

  finalizeOnboarding: async (draft) => {
    const now = new Date().toISOString();
    const generation = sessionGeneration;
    let existingProfile: Spawter | null = null;

    // 1. Récupérer l'auth user (mode live) ou fallback mock (mode démo Expo Go).
    // Import statique de `supabase` : OK car le module ne crée le client qu'avec
    // les env vars (`createClient(url, key)` accepte des strings vides). En mode
    // démo le client existe mais n'est jamais appelé (le `if isSupabaseConfigured`
    // ci-dessous gate l'appel `auth.getUser`).
    let id: string;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw new Error("FINALIZE_NO_AUTH_USER");
      }
      id = data.user.id;
      const current = await readAuthenticatedAccount(id);
      if (generation !== sessionGeneration) throw new Error("ACCOUNT_SESSION_CHANGED");
      if (current.kind === "existing") {
        await get().recoverAuthenticatedAccount(id);
        return "restored";
      }
      if (canResumeMissingPalais(current)) existingProfile = current.spawter;
      else if (current.kind === "incomplete") throw new Error("ACCOUNT_INCOMPLETE");
    } else {
      id = SAMPLE_SPAWTER.id;
    }

    // Story 4.8 — `age_range` est dérivé de `date_of_birth` via helper pur.
    // L'invariant analytics tient (Madame Sun consomme `age_range` only) tandis
    // que `date_of_birth` reste DB-only (jamais émis dans les events).
    const derivedAgeRange = draft.date_of_birth
      ? ageRangeFromDateOfBirth(draft.date_of_birth)
      : null;

    const heritage = draft.meute_heritage;
    const initial = initialMeutePalais(draft);
    const initialArchetype = initial.archetype;

    const spawter: Spawter = {
      ...(existingProfile ?? SAMPLE_SPAWTER),
      id,
      phone_e164: draft.phone_e164,
      display_name: draft.display_name,
      neighborhood: draft.neighborhood,
      country_code: draft.country_code,
      origin_country_code: draft.origin_country_code,
      gender: draft.gender,
      date_of_birth: draft.date_of_birth,
      age_range: derivedAgeRange,
      cgv_accepted_at: existingProfile?.cgv_accepted_at ?? draft.consent.cgv_accepted_at,
      geoloc_consent_at: existingProfile?.geoloc_consent_at ?? draft.consent.geoloc_consent_at,
      pionnier_seq: existingProfile?.pionnier_seq ?? initial.pionnierSeq,
      created_at: existingProfile?.created_at ?? now,
      updated_at: now,
    };

    const ax = initial.axes;
    spawter.quiz_archetype = initialArchetype;

    const palais: UserPalais = {
      ...EMPTY_PALAIS,
      spawter_id: id,
      ...ax,
      confidence_score: initial.confidence,
      dominant_axes: dominantAxes(ax),
      // Sync miroir : `user_palais.archetype_id` (colonne 0008) reflète
      // toujours `spawters.quiz_archetype` (colonne 0033, source de vérité).
      archetype_id: initialArchetype,
      stade: "touriste",
      total_spawts: 0,
      updated_at: now,
    };

    // 2. Local-first (AsyncStorage commit avant tout sync réseau).
    if (isSupabaseConfigured) {
      await resetPending;
      await withAccountStorage(async () => {
        if (generation !== sessionGeneration) throw new Error("ACCOUNT_SESSION_CHANGED");
        await requireAccountSession(id);
        await saveRecoveredAccountLocal(spawter, palais, () => generation === sessionGeneration);
      });
    } else {
      await Promise.all([saveSpawterLocal(spawter), savePalaisLocal(palais)]);
    }
    if (generation !== sessionGeneration) throw new Error("ACCOUNT_SESSION_CHANGED");

    // 3. Synchroniser profil → Palais (FK) → claim définitif. Le preview OTP
    // n'a créé aucune ligne. La synchronisation reste best-effort : sa reprise
    // durable et sa visibilité ne sont pas reçues par ce lot.
    void (async () => {
      try {
        await saveSpawter(spawter);
      } catch (err) {
        if (__DEV__) console.warn("[spawter-store] saveSpawter finalize failed", err);
        return; // la ligne n'est peut-être pas côté serveur → ne pas re-claim
      }
      // Le Palais dépend du profil (FK). Un preview n'est pas encore un claim.
      try {
        await savePalais(palais);
      } catch (err) {
        if (__DEV__) console.warn("[spawter-store] savePalais finalize failed", err);
      }
      if (heritage?.claimed) return;
      try {
        const claim = await claimMeuteHeritage(id, spawter.phone_e164);
        const cur = get().spawter;
        if (!cur || cur.id !== id) return; // compte changé entretemps
        // Une recalibration volontaire garde ses axes et son archétype courant.
        // La RPC conserve néanmoins le rang et le parrainage historiques.
        if (claim?.claimed && draft.use_meute_axes === false && isArchetypeKey(cur.quiz_archetype)) {
          await updateSpawterArchetype(id, cur.quiz_archetype);
          if (get().spawter?.id !== id) return;
        }
        const adoptedClaim = claim && draft.use_meute_axes === false
          ? { ...claim, archetype: cur.quiz_archetype } : claim;
        const applied = applyMeuteHeritage(cur, get().palais, adoptedClaim);
        if (!applied) return;
        await saveSpawterLocal(applied.spawter);
        if (applied.palais) await savePalaisLocal(applied.palais);
        // Re-vérifie l'identité APRÈS les I/O (course logout/login).
        if (get().spawter?.id !== id) return;
        set(applied.palais ? { spawter: applied.spawter, palais: applied.palais } : { spawter: applied.spawter });
        // Analytics : seulement pour un claim FRAIS (pas une ré-adoption au
        // re-login/réinstallation, already_claimed) — évite le double-comptage.
        if (claim?.claimed) {
          track({
            name: "archetype_assigned",
            properties: {
              archetype: applied.spawter.quiz_archetype,
              source: "meute_heritage",
              runner_up: null,
              pionnier_seq: applied.spawter.pionnier_seq,
            },
          });
        }
        void get()
          .unlockTitle(applied.titleKey, "badge")
          .catch((err) => {
            if (__DEV__) console.warn("[spawter-store] unlockTitle heritage failed", err);
          });
      } catch (err) {
        if (__DEV__) console.warn("[spawter-store] adopt meute heritage failed", err);
      }
    })();

    set({ spawter, palais });

    // Chantier 13 archétypes — event + titre de collection à l'assignation.
    // `source` distingue héritage vs calibration pour Madame Sun (KPI funnel
    // quiz → app). Titre inséré avec source='badge' (CHECK 0014 — cf.
    // titres-catalogue.ts) ; unlockTitle est idempotent.
    track({
      name: "archetype_assigned",
      properties: {
        archetype: initialArchetype,
        source: initial.inherited ? "meute_heritage" : "calibration",
        runner_up: initial.runnerUp,
        pionnier_seq: spawter.pionnier_seq,
      },
    });
    void get()
      .unlockTitle(ARCHETYPES[initialArchetype].titleKey, "badge")
      .catch((err) => {
        if (__DEV__) console.warn("[spawter-store] unlockTitle archetype failed", err);
      });

    // 4. Reset draft (libère mémoire + sécurise contre relance accidentelle).
    useOnboardingDraft.getState().reset();
  },

  registerSpawt: async (s) => {
    await appendSpawtLocal(s);
    const list = [s, ...get().spawts];
    const spawter = get().spawter;
    if (spawter) {
      const previousTotalSpawts = spawter.total_spawts;
      // CR finding C1 (CRITIQUE) — exclure les rows seed du compteur unique_spots
      // pour éviter qu'un user en mode démo (DB seed avec is_verified=true) ne
      // franchisse des stades artificiellement. PRD §4.3 anti-fraude.
      const uniqueSpots = new Set(
        list.filter((x) => x.is_verified && !x.is_seed).map((x) => x.place_id),
      ).size;
      // PRD §5.2 — la maturité ne recule jamais. Si un check-in passe is_verified
      // false (rejet antifraude serveur), uniqueSpots peut chuter et getStade()
      // redescendre — on protège via maxStade(currentStade, candidateStade).
      const candidate = getStade(uniqueSpots);
      const updated: Spawter = {
        ...spawter,
        total_spawts: list.length,
        unique_spots: uniqueSpots,
        stade: maxStade(spawter.stade, candidate),
        updated_at: new Date().toISOString(),
      };
      await saveSpawterLocal(updated);
      // P16 — capture unhandled rejection sur le fire-and-forget Supabase.
      void persistSpawterFiable(updated);

      // Story 5.1 — Détection franchissement de seuil de stade.
      // maxStade a déjà filtré les baisses → une différence ici est une montée garantie.
      const stadeChanged = updated.stade !== spawter.stade;
      let pendingStadeCelebration:
        | {
            from_stade: import("../types/stade").Stade;
            to_stade: import("../types/stade").Stade;
            unique_spots: number;
          }
        | null = null;
      if (stadeChanged) {
        track({
          name: "stade_unlocked",
          properties: {
            from_stade: spawter.stade,
            to_stade: updated.stade,
            unique_spots: uniqueSpots,
          },
        });
        // Story 5.4 — pending celebration transient (anti-replay AsyncStorage par stade).
        // CR finding M7 — guard in-flight synchrone AVANT le check async pour
        // qu'un 2e registerSpawt parallèle ne tombe pas dans le même if.
        const alreadyInFlight = __celebrationInFlight.has(updated.stade);
        const alreadyCelebrated = await isStadeCelebrated(updated.stade);
        if (!alreadyInFlight && !alreadyCelebrated) {
          __celebrationInFlight.add(updated.stade);
          pendingStadeCelebration = {
            from_stade: spawter.stade,
            to_stade: updated.stade,
            unique_spots: uniqueSpots,
          };
        }
        // CR finding M8 — Story 5.2 — unlock TOUS les titres intermédiaires entre
        // l'ancien stade et le nouveau (cas saut multi-stade : touriste → detective
        // doit unlock `title.explorateur` ET `title.detective`).
        const titlesToUnlock = stadeTitleKeysBetween(spawter.stade, updated.stade);
        for (const titleKey of titlesToUnlock) {
          void get()
            .unlockTitle(titleKey, "stade")
            .catch((err) => {
              if (__DEV__) console.warn("[spawter-store] unlockTitle stade failed", err);
            });
        }
      }

      // Story 5.1 + CR finding D4 — Sync `spawter_progression` (overwrite) fire-and-forget.
      // current_title = titre affiché user-choisi s'il existe (préserve le choix au
      // franchissement de stade), sinon défaut du nouveau stade.
      const displayed = get().collectionTitres.find((r) => r.is_displayed);
      const currentTitleForSync = displayed?.title_key ?? STADE_TITLE_KEYS[updated.stade];
      void upsertProgression({
        spawter_id: updated.id,
        unique_spots: uniqueSpots,
        stade: updated.stade,
        current_title: currentTitleForSync,
        updated_at: updated.updated_at,
      }).catch((err) => {
        if (__DEV__) console.warn("[spawter-store] upsertProgression failed", err);
      });

      // Story 4.2 — Premier Spawt detect : transition total_spawts: 0 → 1 ET
      // is_verified === true. Anti-replay via AsyncStorage set-once.
      let pendingBadge: PendingBadge | null = null;
      if (previousTotalSpawts === 0 && s.is_verified) {
        const alreadyCelebrated = await isPremierSpawtCelebrated();
        if (!alreadyCelebrated) {
          pendingBadge = { place_id: s.place_id };
          const onboardingMs = new Date(spawter.created_at).getTime();
          const hours = Number.isFinite(onboardingMs)
            ? Math.max(0, (Date.now() - onboardingMs) / 3_600_000)
            : 0;
          track({
            name: "spawt_first_completed",
            properties: {
              place_id: s.place_id,
              time_since_onboarding_hours: Math.round(hours * 10) / 10,
            },
          });
        }
      }

      set({
        spawter: updated,
        spawts: list,
        ...(pendingBadge ? { pendingBadge } : {}),
        ...(pendingStadeCelebration ? { pendingStadeCelebration } : {}),
      });

      // Progression — spawt vérifié → évaluation serveur des badges.
      // Best-effort fire-and-forget : jamais bloquant pour le flux du spawt,
      // no-op si le flag badges-v2 est off (gate interne).
      if (s.is_verified) {
        void notifySpawtVerified(updated.id);
      }
    } else {
      set({ spawts: list });
    }
  },

  attachReviewToSpawt: async (spawt_id, patch) => {
    const list = get().spawts;
    const idx = list.findIndex((s) => s.id === spawt_id);
    if (idx === -1) {
      if (__DEV__) console.warn("[spawter-store] attachReviewToSpawt — spawt not found", spawt_id);
      return;
    }
    const existing = list[idx]!;
    const updated_at = new Date().toISOString();
    const updatedRow: SpawtCheckin = {
      ...existing,
      note_etoiles: patch.note_etoiles,
      texte_avis: patch.texte_avis,
      tags: patch.tags,
      photos: patch.photos,
      updated_at,
    };
    const updatedList = list.slice();
    updatedList[idx] = updatedRow;
    // Persist local (re-write all spawts AsyncStorage — simple, cohérent storage.ts).
    const { default: AsyncStorageMod } = await import(
      "@react-native-async-storage/async-storage"
    );
    await AsyncStorageMod.setItem("spawt:spawts", JSON.stringify(updatedList));
    set({ spawts: updatedList });

    // Fire-and-forget Supabase via offline-queue wrapper (Story 4.3).
    void saveSpawtToSupabaseOrEnqueue({
      kind: "spawt_update",
      row_id: spawt_id,
      patch: {
        note_etoiles: patch.note_etoiles,
        texte_avis: patch.texte_avis,
        tags: patch.tags,
        photos: patch.photos,
        updated_at,
      },
    }).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] attachReviewToSpawt sync failed", err);
    });

    // Story 4.6 — fire-and-forget Palais update.
    const palaisState = get().palais;
    const spawterState = get().spawter;
    if (palaisState && spawterState) {
      const { palais: newPalais, didUpdate } = applyReviewToPalais({
        current: palaisState,
        unique_spots: spawterState.unique_spots,
        note: patch.note_etoiles,
        tags: patch.tags,
        place_signals: [], // TODO Story 4.6 — alimenter via lookup place
      });
      if (didUpdate) {
        await savePalaisLocal(newPalais);
        void savePalais(newPalais).catch((err) => {
          if (__DEV__) console.warn("[spawter-store] savePalais review update failed", err);
        });
        set({ palais: newPalais });

        // Chantier 13 archétypes — recalcul post-mise-à-jour du Palais
        // (spawt vérifié + avis = seul flux qui bouge les axes). Règle
        // d'inertie PRD §5.5 : le candidat doit rester identique sur
        // MUE_STABILITY_THRESHOLD recalculs consécutifs ET différer de
        // l'actuel avant de muer. Fire-and-forget — jamais bloquant pour
        // l'UX de l'avis.
        void (async () => {
          const result = computeArchetypeFromPalais(newPalais);
          const sp = get().spawter;
          if (!sp) return;
          const current = isArchetypeKey(sp.quiz_archetype) ? sp.quiz_archetype : null;
          const streak = await loadMueStreak();
          const transition = evaluateArchetypeTransition({
            current,
            candidate: result.key,
            streak,
          });
          if (transition.type === "none") {
            await saveMueStreak(transition.streak);
            return;
          }
          // "assign" (spawter legacy sans archétype) ou "mue" : même écriture
          // locale + remote, seul le ton diffère (la mue a un constat Chat).
          const to = transition.to;
          const updatedSpawter: Spawter = {
            ...sp,
            quiz_archetype: to,
            updated_at: new Date().toISOString(),
          };
          const palaisWithArchetype: UserPalais = {
            ...(get().palais ?? newPalais),
            archetype_id: to,
          };
          await Promise.all([
            saveSpawterLocal(updatedSpawter),
            savePalaisLocal(palaisWithArchetype),
            saveMueStreak(null),
          ]);
          // UPDATE ciblé `spawters.quiz_archetype` (0033) — pas d'upsert row
          // entier, pour ne clobber aucune colonne serveur.
          void updateSpawterArchetype(sp.id, to).catch((err) => {
            if (__DEV__) console.warn("[spawter-store] updateSpawterArchetype failed", err);
          });
          void savePalais(palaisWithArchetype).catch((err) => {
            if (__DEV__) console.warn("[spawter-store] savePalais archetype failed", err);
          });
          if (transition.type === "mue") {
            const pendingMue: PendingMue = { from: transition.from, to };
            await savePendingMue(pendingMue);
            set({ spawter: updatedSpawter, palais: palaisWithArchetype, pendingMue });
            track({
              name: "archetype_mue",
              properties: { from: transition.from, to, runner_up: result.runnerUp },
            });
          } else {
            set({ spawter: updatedSpawter, palais: palaisWithArchetype });
            track({
              name: "archetype_assigned",
              properties: { archetype: to, source: "recalc_legacy", runner_up: result.runnerUp },
            });
          }
          // Entrée dans la collection de titres (mémoire d'identité) —
          // source='badge' (CHECK 0014), clé `title.archetype.<key>`.
          void get()
            .unlockTitle(ARCHETYPES[to].titleKey, "badge")
            .catch((err) => {
              if (__DEV__) console.warn("[spawter-store] unlockTitle mue failed", err);
            });
        })().catch((err) => {
          if (__DEV__) console.warn("[spawter-store] archetype recalc failed", err);
        });
      }
    }

    // Story 4.7 — fire-and-forget ADN update (local state UI + remote recompute).
    void recomputeAndPersistPlaceAdn({
      place_id: existing.place_id,
      review: {
        note_etoiles: patch.note_etoiles,
        tags: patch.tags,
        spawter_stade: spawterState?.stade ?? "touriste",
        is_seed: existing.is_seed,
      },
    }).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] recompute ADN failed", err);
    });

    track({
      name: "review_submitted",
      properties: {
        place_id: existing.place_id,
        note_etoiles: patch.note_etoiles,
        tags_count: patch.tags.length,
        text_length: (patch.texte_avis ?? "").length,
        photos_count: patch.photos.length,
      },
    });
  },

  reset: () => {
    sessionGeneration += 1;
    __goldRefreshInFlight = null;
    // Sprint 2 Gold — purge du cache module synchrone (isGoldSpawter) AVANT
    // le state : un nouveau compte sur le même device ne doit jamais hériter
    // du droit Gold du précédent.
    setGoldEntitlementState(null);
    // Comptes internes (0060) — même raison : le statut ET la bascule Gold
    // simulée sont attachés au COMPTE, pas à l'appareil. Sans cette purge, un
    // compte ordinaire qui s'inscrit après un compte interne sur le même
    // téléphone hériterait du menu et de l'aperçu Gold.
    setInternalAccount(false);
    set({
      spawter: null,
      palais: null,
      spawts: [],
      savedPlaceIds: new Set(),
      savedUnavailable: false,
      gold: null,
      pendingBadge: null,
      collectionTitres: [],
      pendingStadeCelebration: null,
      pendingMue: null,
    });
    // Privacy V1 — CR finding M2 : purger TOUS les caches AsyncStorage qui
    // gardent une trace d'identité utilisateur (fuite cross-user sur même device).
    // Les données de compte et consentements sont purgés aussi : une simple
    // relance après déconnexion ne doit pas restaurer le compte précédent.
    const keysToPurge = [
      "spawt:spawter",
      "spawt:palais",
      "spawt:spawts",
      "spawt:consent:cgv",
      "spawt:consent:geoloc",
      "spawt:consent:data",
      "spawt:collection_titres",
      // Sprint 2 Gold — l'entitlement est un droit de COMPTE (fuite cross-user
      // sinon : le badge doré survivrait au changement de spawter).
      GOLD_STORAGE_KEY,
      // Comptes internes (0060) — la bascule « voir l'app comme un Gold » est
      // un réglage de compte, pas d'appareil.
      INTERNAL_GOLD_KEY,
      BADGE_CELEBRATED_KEY,
      // Chantier 13 archétypes — compteur d'inertie + constat de mue en attente
      // (fuite cross-user sinon, même logique que les flags de célébration).
      MUE_STREAK_STORAGE_KEY,
      PENDING_MUE_STORAGE_KEY,
      // Progression — sets « déjà vu » des célébrations badges/cartes (un
      // nouveau compte repartirait sinon avec l'anti-replay du précédent).
      BADGES_SEEN_KEY,
      CARDS_SEEN_KEY,
      // finding P2#7 — caches feature V2 oubliés à la purge : résas, suggestions
      // de lieux, dernière session Crew et token push. Sans ça, les résas /
      // suggestions / la session Crew d'un ancien compte restent visibles sur le
      // même device, et le token push reste rattaché à l'ancien compte. Clés en
      // dur (les modules propriétaires importent spawter-store → pas d'import
      // statique ici pour éviter un cycle) — verrouillées par un test de dérive.
      "spawt:reservations", // reservations.ts STORAGE_KEY
      "spawt:place-suggestions", // place-suggestions.ts STORAGE_KEY
      "spawt:crew:last-session", // crew-store CREW_SESSION_STORAGE_KEY
      "spawt:push:token", // push-token.ts PUSH_TOKEN_STORAGE_KEY
      ...STADE_ORDER.map((s) => `${STADE_CELEBRATED_KEY}:${s}`),
    ];
    resetPending = Promise.all([purgeSavedPlaces(), withAccountStorage(() => AsyncStorage.multiRemove(keysToPurge))]);
    void resetPending.catch((err) => {
      if (__DEV__) console.warn("[spawter-store] reset multiRemove failed", err);
    });
    // Crew : vide l'état transient en mémoire (session/membres/propositions) et
    // la référence persistée du compte précédent (finding P2#7). Le cycle
    // crew-store ⇄ spawter-store est runtime-only des deux côtés (aucun usage à
    // l'initialisation), donc sûr sous Metro.
    void useCrewStore
      .getState()
      .leave()
      .catch((err) => {
        if (__DEV__) console.warn("[spawter-store] crew leave on reset failed", err);
      });
    // CR finding M7 — vide aussi le guard in-flight pour que le prochain user
    // puisse célébrer chaque stade comme un nouveau parcours.
    __celebrationInFlight.clear();
    // Progression — état en mémoire remis à zéro (badges/cartes/paws du
    // compte précédent ne doivent pas survivre au changement de spawter).
    useProgressionStore.getState().reset();
  },
}));

/** Helper : delta de calibrage signé selon réponse utilisateur (PRD §20.2 → -0.4/+0.4). */
export function calibrationDelta(direction: "neg" | "pos" | "neutral"): CalibrationDelta {
  if (direction === "neg") return -0.4;
  if (direction === "pos") return 0.4;
  return 0;
}

/** Story 4.2 — Anti-replay du badge Premier Spawt. Set-once AsyncStorage. */
async function isPremierSpawtCelebrated(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(BADGE_CELEBRATED_KEY);
    return Boolean(v && v.length > 0);
  } catch {
    return false;
  }
}

/** Story 5.4 — Anti-replay de la célébration de stade. 1 flag par stade-cible. */
async function isStadeCelebrated(stade: import("../types/stade").Stade): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(`${STADE_CELEBRATED_KEY}:${stade}`);
    return Boolean(v && v.length > 0);
  } catch {
    return false;
  }
}
