// Brouillon onboarding — éphémère (en mémoire), commité au store final
// quand les 5 questions de calibrage sont passées.

import { create } from "zustand";
import type { OnboardingDraft } from "../types/spawter";
import type { PalaisAxis } from "../types/palais";

const initial: OnboardingDraft = {
  phone_e164: "",
  display_name: "",
  email: null,
  neighborhood: "",
  country_code: "CI",
  origin_country_code: null,
  gender: "non_renseigne",
  age_range: null,
  consent: {
    cgv_accepted_at: null,
    geoloc_consent_at: null,
  },
  calibration_answers: {
    racines_horizons: 0,
    taniere_nomade: 0,
    exigeant_enthousiaste: 0,
    foule_secret: 0,
    maquis_table: 0,
  },
  started_at: null,
};

interface DraftStore {
  draft: OnboardingDraft;
  setField: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  // P-33 — sentinel `null` autorisé pour skip explicite.
  setCalibration: (axis: PalaisAxis, value: number | null) => void;
  /** Story 2.2 / FR-040 — historise un timestamp consent pré-auth dans le draft. */
  setConsent: (kind: "cgv" | "geoloc", at: string | null) => void;
  reset: () => void;
}

export const useOnboardingDraft = create<DraftStore>((set) => ({
  draft: initial,
  setField: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),
  setCalibration: (axis, value) =>
    set((s) => ({
      draft: {
        ...s.draft,
        calibration_answers: { ...s.draft.calibration_answers, [axis]: value },
      },
    })),
  setConsent: (kind, at) =>
    set((s) => ({
      draft: {
        ...s.draft,
        consent: {
          ...s.draft.consent,
          [kind === "cgv" ? "cgv_accepted_at" : "geoloc_consent_at"]: at,
        },
      },
    })),
  reset: () => set({ draft: initial }),
}));
