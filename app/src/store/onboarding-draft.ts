// Brouillon onboarding — éphémère (en mémoire), commité au store final
// quand les 5 questions de calibrage sont passées.

import { create } from "zustand";
import type { OnboardingDraft } from "../types/spawter";
import type { PalaisAxis } from "../types/palais";

const initial: OnboardingDraft = {
  phone_e164: "",
  display_name: "",
  neighborhood: "",
  country_code: "CI",
  origin_country_code: null,
  gender: "non_renseigne",
  age_range: null,
  calibration_answers: {
    racines_horizons: 0,
    taniere_nomade: 0,
    exigeant_enthousiaste: 0,
    foule_secret: 0,
    maquis_table: 0,
  },
};

interface DraftStore {
  draft: OnboardingDraft;
  setField: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  setCalibration: (axis: PalaisAxis, value: number) => void;
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
  reset: () => set({ draft: initial }),
}));
