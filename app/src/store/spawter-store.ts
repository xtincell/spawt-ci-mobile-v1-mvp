// Store Zustand pour le spawter actif + son Palais + ses spawts locaux.
// Persiste via AsyncStorage. Synchronise vers Supabase si configuré.

import { create } from "zustand";

import type { Spawter, OnboardingDraft } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { SpawtCheckin } from "../types/spawt";
import type { CalibrationDelta } from "../types/palais";

import {
  loadSpawter,
  loadPalais,
  loadSpawts,
  saveSpawterLocal,
  savePalaisLocal,
  appendSpawtLocal,
  setConsent as setConsentLocal,
} from "../lib/storage";
import { saveSpawter, savePalais, isSupabaseConfigured } from "../lib/data-source";
import { supabase } from "../lib/supabase";
import { dominantAxes, computeConfidence } from "../lib/palais-engine";
import { getStade } from "../types/stade";
import { EMPTY_PALAIS, SAMPLE_SPAWTER } from "../data/seed/sample-spawter";
import { useOnboardingDraft } from "./onboarding-draft";

interface SpawterStore {
  /** true tant que loadAll n'a pas terminé (boot de l'app) */
  hydrating: boolean;
  spawter: Spawter | null;
  palais: UserPalais | null;
  spawts: SpawtCheckin[];

  hydrate: () => Promise<void>;
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
  reset: () => void;
}

export const useSpawterStore = create<SpawterStore>((set, get) => ({
  hydrating: true,
  spawter: null,
  palais: null,
  spawts: [],

  hydrate: async () => {
    const [spawter, palais, spawts] = await Promise.all([
      loadSpawter(),
      loadPalais(),
      loadSpawts(),
    ]);
    set({ spawter, palais, spawts, hydrating: false });
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
      const uniqueSpots = new Set(list.filter((x) => x.is_verified).map((x) => x.place_id)).size;
      const updated: Spawter = {
        ...spawter,
        total_spawts: list.length,
        unique_spots: uniqueSpots,
        stade: getStade(uniqueSpots),
        updated_at: new Date().toISOString(),
      };
      await saveSpawterLocal(updated);
      // P16 — capture unhandled rejection sur le fire-and-forget Supabase.
      void saveSpawter(updated).catch((err) => {
        if (__DEV__) console.warn("[spawter-store] saveSpawter registerSpawt failed", err);
      });
      set({ spawter: updated, spawts: list });
    } else {
      set({ spawts: list });
    }
  },

  reset: () => {
    set({ spawter: null, palais: null, spawts: [] });
  },
}));

/** Helper : delta de calibrage signé selon réponse utilisateur (PRD §20.2 → -0.4/+0.4). */
export function calibrationDelta(direction: "neg" | "pos" | "neutral"): CalibrationDelta {
  if (direction === "neg") return -0.4;
  if (direction === "pos") return 0.4;
  return 0;
}
