// Store Zustand pour le spawter actif + son Palais + ses spawts locaux.
// Persiste via AsyncStorage. Synchronise vers Supabase si configuré.

import { create } from "zustand";

import type { Spawter, OnboardingDraft } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { SpawtCheckin, ReviewTag } from "../types/spawt";
import type { CalibrationDelta } from "../types/palais";

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
} from "../lib/storage";
import { saveSpawter, savePalais, isSupabaseConfigured } from "../lib/data-source";
import { saveSpawtToSupabaseOrEnqueue } from "../lib/offline-queue";
import { applyReviewToPalais } from "../lib/palais-signals";
import { recomputeAndPersistPlaceAdn } from "../lib/place-adn-update";
import { supabase } from "../lib/supabase";
import { dominantAxes, computeConfidence } from "../lib/palais-engine";
import { getStade, maxStade } from "../types/stade";
import { EMPTY_PALAIS, SAMPLE_SPAWTER } from "../data/seed/sample-spawter";
import { useOnboardingDraft } from "./onboarding-draft";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { track } from "../lib/analytics";

const BADGE_CELEBRATED_KEY = "spawt:badge:premier_spawt_celebrated";

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

export const useSpawterStore = create<SpawterStore>((set, get) => ({
  hydrating: true,
  spawter: null,
  palais: null,
  spawts: [],
  savedPlaceIds: new Set(),
  pendingBadge: null,

  consumePendingBadge: async () => {
    set({ pendingBadge: null });
    try {
      await AsyncStorage.setItem(BADGE_CELEBRATED_KEY, new Date().toISOString());
    } catch (err) {
      if (__DEV__) console.warn("[spawter-store] consumePendingBadge flag write failed", err);
    }
  },

  hydrate: async () => {
    const [spawter, palais, spawts, savedPlaceIds] = await Promise.all([
      loadSpawter(),
      loadPalais(),
      loadSpawts(),
      loadSaved(),
    ]);
    set({ spawter, palais, spawts, savedPlaceIds, hydrating: false });
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
    // Supabase sync différé Sprint 2 (Option A — cf. Story 3.6 Dev Notes §1).
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

    const spawter: Spawter = {
      ...SAMPLE_SPAWTER,
      id,
      phone_e164: draft.phone_e164,
      display_name: draft.display_name,
      neighborhood: draft.neighborhood,
      country_code: draft.country_code,
      origin_country_code: draft.origin_country_code,
      gender: draft.gender,
      age_range: draft.age_range,
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
      const uniqueSpots = new Set(list.filter((x) => x.is_verified).map((x) => x.place_id)).size;
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
    set({ spawter: null, palais: null, spawts: [], savedPlaceIds: new Set(), pendingBadge: null });
    // Privacy : purger le cache AsyncStorage des favoris pour qu'un user suivant
    // sur le même device n'hérite pas des spots sauvegardés. Les autres clés
    // (spawter, palais, spawts, consent) restent gérées par leurs propres flux.
    void AsyncStorage.removeItem("spawt:saved_places").catch((err) => {
      if (__DEV__) console.warn("[spawter-store] reset saved_places clear failed", err);
    });
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
