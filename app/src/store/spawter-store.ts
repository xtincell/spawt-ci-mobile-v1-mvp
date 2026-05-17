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
  recordConsent: (kind: "cgv" | "geoloc", accepted: boolean) => Promise<void>;
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
      const updated: Spawter = {
        ...current,
        [fieldName]: accepted ? new Date().toISOString() : null,
      };
      await saveSpawterLocal(updated);
      void saveSpawter(updated);
      set({ spawter: updated });
    }
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

    const palais: UserPalais = {
      ...EMPTY_PALAIS,
      spawter_id: id,
      axe_racines_horizons: draft.calibration_answers.racines_horizons,
      axe_taniere_nomade: draft.calibration_answers.taniere_nomade,
      axe_exigeant_enthousiaste: draft.calibration_answers.exigeant_enthousiaste,
      axe_foule_secret: draft.calibration_answers.foule_secret,
      axe_maquis_table: draft.calibration_answers.maquis_table,
      confidence_score: computeConfidence(0),
      dominant_axes: dominantAxes({
        axe_racines_horizons: draft.calibration_answers.racines_horizons,
        axe_taniere_nomade: draft.calibration_answers.taniere_nomade,
        axe_exigeant_enthousiaste: draft.calibration_answers.exigeant_enthousiaste,
        axe_foule_secret: draft.calibration_answers.foule_secret,
        axe_maquis_table: draft.calibration_answers.maquis_table,
      }),
      stade: "touriste",
      total_spawts: 0,
      updated_at: now,
    };

    // 2. Local-first (AsyncStorage commit avant tout sync réseau).
    await Promise.all([saveSpawterLocal(spawter), savePalaisLocal(palais)]);

    // 3. Fire-and-forget Supabase — règle d'or project-context.
    void saveSpawter(spawter);
    void savePalais(palais);

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
      void saveSpawter(updated);
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
