// Store Zustand pour le spawter actif + son Palais + ses spawts locaux.
// Persiste via AsyncStorage. Synchronise vers Supabase si configuré.

import { create } from "zustand";

import type { Spawter, OnboardingDraft } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { SpawtCheckin, ReviewTag } from "../types/spawt";
import type { CalibrationDelta } from "../types/palais";
import type { CollectionTitreRow } from "../types/collection-titres";

import {
  loadSpawter,
  loadPalais,
  loadSpawts,
  loadSaved,
  saveSavedLocal,
  saveSpawterLocal,
  savePalaisLocal,
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
  listSavedPlaceIds,
  saveSavedPlace,
  deleteSavedPlace,
} from "../lib/data-source";
import {
  isKnownTitleKey,
  STADE_TITLE_KEYS,
  STADE_ORDER,
  PREMIER_SPAWT_TITLE_KEY,
  stadeTitleKeysBetween,
  type TitleSource,
} from "../lib/titres-catalogue";
import { saveSpawtToSupabaseOrEnqueue } from "../lib/offline-queue";
import { applyReviewToPalais } from "../lib/palais-signals";
import { ageRangeFromDateOfBirth } from "../lib/age-range";
import { recomputeAndPersistPlaceAdn } from "../lib/place-adn-update";
import { supabase } from "../lib/supabase";
import { dominantAxes, computeConfidence } from "../lib/palais-engine";
import { getStade, maxStade } from "../types/stade";
import { EMPTY_PALAIS, SAMPLE_SPAWTER } from "../data/seed/sample-spawter";
import { useOnboardingDraft } from "./onboarding-draft";
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
  /**
   * Story 3.6 — Toggle un place_id dans/hors favoris.
   * Local-first immédiat (AsyncStorage + state), fire-and-forget Supabase (V1 stub).
   * Retourne `true` si ajouté, `false` si retiré — utilisé par analytics.
   */
  toggleSaved: (place_id: string) => Promise<boolean>;
  /** Test d'appartenance — synchrone, no I/O. */
  isSaved: (place_id: string) => boolean;
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
  finalizeOnboarding: (draft: OnboardingDraft) => Promise<void>;
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

export const useSpawterStore = create<SpawterStore>((set, get) => ({
  hydrating: true,
  spawter: null,
  palais: null,
  spawts: [],
  savedPlaceIds: new Set(),
  pendingBadge: null,
  collectionTitres: [],
  pendingStadeCelebration: null,

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

  hydrate: async () => {
    const [spawter, palais, spawts, savedPlaceIds, collectionTitres] = await Promise.all([
      loadSpawter(),
      loadPalais(),
      loadSpawts(),
      loadSaved(),
      loadCollectionTitres(),
    ]);
    set({ spawter, palais, spawts, savedPlaceIds, collectionTitres, hydrating: false });

    // Câblage MVP — favoris cross-device : union-merge local ∪ remote en
    // arrière-plan (local-first, jamais bloquant). Les favoris locaux absents
    // du remote sont poussés (rattrapage offline). Une suppression faite sur
    // un autre device pendant que celui-ci était offline peut ressusciter —
    // arbitrage V1 assumé (pas de tombstones), cf. migration 0024.
    if (spawter) {
      void (async () => {
        const remote = await listSavedPlaceIds(spawter.id);
        if (remote === null) return;
        const local = get().savedPlaceIds;
        const merged = new Set([...local, ...remote]);
        const remoteSet = new Set(remote);
        for (const id of local) {
          if (!remoteSet.has(id)) void saveSavedPlace(spawter.id, id);
        }
        if (merged.size !== local.size) {
          const ok = await saveSavedLocal(merged);
          if (ok) set({ savedPlaceIds: merged });
        }
      })().catch((err) => {
        if (__DEV__) console.warn("[spawter-store] saved sync failed", err);
      });
    }
  },

  toggleSaved: async (place_id: string) => {
    const current = get().savedPlaceIds;
    const next = new Set(current);
    let wasAdded: boolean;
    if (next.has(place_id)) {
      next.delete(place_id);
      wasAdded = false;
    } else {
      next.add(place_id);
      wasAdded = true;
    }
    // Local-first : commit AsyncStorage AVANT le state. Si AsyncStorage
    // échoue (quota, IO), on n'avance pas le state — sinon state et disque
    // divergent jusqu'au prochain hydrate, qui silently reverterait le toggle.
    const ok = await saveSavedLocal(next);
    if (!ok) return get().savedPlaceIds.has(place_id);
    set({ savedPlaceIds: next });
    // Câblage MVP — sync remote fire-and-forget (union-merge au prochain
    // hydrate en cas d'échec réseau ici).
    const spawter = get().spawter;
    if (spawter) {
      if (wasAdded) {
        void saveSavedPlace(spawter.id, place_id);
      } else {
        void deleteSavedPlace(spawter.id, place_id);
      }
    }
    return wasAdded;
  },

  isSaved: (place_id: string) => get().savedPlaceIds.has(place_id),

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
      void saveSpawter(updated).catch((err) => {
        if (__DEV__) console.warn("[spawter-store] saveSpawter consent failed", err);
      });
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
    void saveSpawter(updated).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] saveSpawter avatar failed", err);
    });
    set({ spawter: updated });
  },

  finalizeOnboarding: async (draft) => {
    const now = new Date().toISOString();

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
    } else {
      id = SAMPLE_SPAWTER.id;
    }

    // Story 4.8 — `age_range` est dérivé de `date_of_birth` via helper pur.
    // L'invariant analytics tient (Madame Sun consomme `age_range` only) tandis
    // que `date_of_birth` reste DB-only (jamais émis dans les events).
    const derivedAgeRange = draft.date_of_birth
      ? ageRangeFromDateOfBirth(draft.date_of_birth)
      : null;

    const spawter: Spawter = {
      ...SAMPLE_SPAWTER,
      id,
      phone_e164: draft.phone_e164,
      display_name: draft.display_name,
      neighborhood: draft.neighborhood,
      country_code: draft.country_code,
      origin_country_code: draft.origin_country_code,
      gender: draft.gender,
      date_of_birth: draft.date_of_birth,
      age_range: derivedAgeRange,
      cgv_accepted_at: draft.consent.cgv_accepted_at,
      geoloc_consent_at: draft.consent.geoloc_consent_at,
      created_at: now,
      updated_at: now,
    };

    // P-33 — `null` = skip explicite, normalisé en `0` côté DB (axe_* est
    // `real NOT NULL`).
    // DN-5 round 3 — filter strict `v !== null` (skip exclu, neutral résolu
    // value=0 compté comme une réponse délibérée). Cohérent avec le filter
    // côté `palais-reveal.tsx` pour éviter une divergence entre la confidence
    // affichée et la confidence persistée. Voir aussi `documentation/analytics/events.md`
    // section `calibration_answered.value — sémantique`.
    const ax = {
      axe_racines_horizons: draft.calibration_answers.racines_horizons ?? 0,
      axe_taniere_nomade: draft.calibration_answers.taniere_nomade ?? 0,
      axe_exigeant_enthousiaste: draft.calibration_answers.exigeant_enthousiaste ?? 0,
      axe_foule_secret: draft.calibration_answers.foule_secret ?? 0,
      axe_maquis_table: draft.calibration_answers.maquis_table ?? 0,
    };

    const palais: UserPalais = {
      ...EMPTY_PALAIS,
      spawter_id: id,
      ...ax,
      // P1 — count des axes répondus (skip exclu, neutral résolu compté).
      confidence_score: computeConfidence(
        Object.values(draft.calibration_answers).filter(
          (v): v is number => v !== null,
        ).length,
      ),
      dominant_axes: dominantAxes(ax),
      stade: "touriste",
      total_spawts: 0,
      updated_at: now,
    };

    // 2. Local-first (AsyncStorage commit avant tout sync réseau).
    await Promise.all([saveSpawterLocal(spawter), savePalaisLocal(palais)]);

    // 3. Fire-and-forget Supabase — règle d'or project-context.
    // P16 — capture unhandled rejection en `__DEV__` log warn pour traçabilité.
    void saveSpawter(spawter).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] saveSpawter finalize failed", err);
    });
    void savePalais(palais).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] savePalais finalize failed", err);
    });

    set({ spawter, palais });

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
      void saveSpawter(updated).catch((err) => {
        if (__DEV__) console.warn("[spawter-store] saveSpawter registerSpawt failed", err);
      });

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
    set({
      spawter: null,
      palais: null,
      spawts: [],
      savedPlaceIds: new Set(),
      pendingBadge: null,
      collectionTitres: [],
      pendingStadeCelebration: null,
    });
    // Privacy V1 — CR finding M2 : purger TOUS les caches AsyncStorage qui
    // gardent une trace d'identité utilisateur (fuite cross-user sur même device).
    // Les autres clés (spawter, palais, spawts, consent) sont écrasées par leurs
    // propres flux au prochain onboarding.
    const keysToPurge = [
      "spawt:saved_places",
      "spawt:collection_titres",
      BADGE_CELEBRATED_KEY,
      ...STADE_ORDER.map((s) => `${STADE_CELEBRATED_KEY}:${s}`),
    ];
    void AsyncStorage.multiRemove(keysToPurge).catch((err) => {
      if (__DEV__) console.warn("[spawter-store] reset multiRemove failed", err);
    });
    // CR finding M7 — vide aussi le guard in-flight pour que le prochain user
    // puisse célébrer chaque stade comme un nouveau parcours.
    __celebrationInFlight.clear();
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
