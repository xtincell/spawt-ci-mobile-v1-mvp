// Story 2.4 + Story 4.8 — <ProfileScreen /> valide les 6 champs (nom + quartier
// + 4 PII dont `date_of_birth`) avant d'activer Continuer, émet
// onboarding_step_completed.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

import type { CountryCode, Gender } from "../../src/types/spawter";
import type { OnboardingDraft } from "../../src/types/spawter";

// Story 4.8 — Mock du DateTimePicker natif (le module attend des bridges
// natifs absents en environnement Jest). On expose un View testID-able pour
// vérifier le rendering conditionnel ; les interactions onChange ne sont pas
// testées ici (l'effet store est couvert par finalize-onboarding.test.ts).
jest.mock("@react-native-community/datetimepicker", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  const MockDTP = (props: { testID?: string }) =>
    ReactMock.createElement(RNMock.View, { testID: props.testID });
  return { __esModule: true, default: MockDTP };
});

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTrack = jest.fn();
jest.mock("../../src/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

let mockDraftState: OnboardingDraft;

const mockSetField = jest.fn(
  <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    mockDraftState = { ...mockDraftState, [key]: value };
  },
);

jest.mock("../../src/store/onboarding-draft", () => {
  const fn = (selector: (s: { draft: OnboardingDraft; setField: typeof mockSetField }) => unknown) =>
    selector({ draft: mockDraftState, setField: mockSetField });
  return { useOnboardingDraft: fn };
});

import ProfileScreen from "../../app/(onboarding)/profile";

interface FoundProps {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => FoundProps;
  };
  update: (el: ReactNode) => void;
}

function freshDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    phone_e164: "",
    display_name: "",
    email: null,
    neighborhood: "",
    country_code: "CI",
    origin_country_code: null,
    gender: "non_renseigne",
    // Story 4.8 — `age_range` du draft supprimé, remplacé par `date_of_birth`.
    date_of_birth: null,
    consent: { cgv_accepted_at: null, geoloc_consent_at: null },
    calibration_answers: {
      racines_horizons: 0,
      taniere_nomade: 0,
      exigeant_enthousiaste: 0,
      foule_secret: 0,
      maquis_table: 0,
    },
    started_at: null,
    ...overrides,
  };
}

function render(): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(<ProfileScreen />) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("no renderer");
  return raw;
}

describe("<ProfileScreen /> — Story 2.4", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
    mockPush.mockClear();
    mockTrack.mockClear();
    mockSetField.mockClear();
    mockDraftState = freshDraft();
  });

  it("CTA Continuer disabled au mount (name + neighborhood + date_of_birth manquants)", () => {
    const instance = render();
    const cta = instance.root.findByProps({ testID: "profile-continue" });
    expect(cta.props.disabled).toBe(true);
  });

  it("name >=2 + neighborhood >=2 + date_of_birth ≥13 ans → CTA actif → tap → emit + push calibration", () => {
    mockDraftState = freshDraft({
      display_name: "Yann",
      neighborhood: "Cocody",
      // Story 4.8 — date de naissance qui mappe sur âge ≥ 13 ans.
      date_of_birth: "1995-06-15",
    });
    const instance = render();
    const cta = instance.root.findByProps({ testID: "profile-continue" });
    expect(cta.props.disabled).toBe(false);

    TestRenderer.act(() => {
      (cta.props.onPress as () => void)();
    });

    expect(mockTrack).toHaveBeenCalledWith({
      name: "onboarding_step_completed",
      properties: { step: "profile", step_index: 3 },
    });
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/calibration");
  });

  it("origin_country_code peut rester null sans bloquer Continuer", () => {
    mockDraftState = freshDraft({
      display_name: "Yann",
      neighborhood: "Cocody",
      date_of_birth: "1995-06-15",
      origin_country_code: null,
    });
    const instance = render();
    expect(instance.root.findByProps({ testID: "profile-continue" }).props.disabled).toBe(false);
  });

  it("Story 4.8 — date_of_birth < 13 ans → CTA disabled + message inline affiché", () => {
    // Born "today" in spec sense → âge calculé est < 13 ans.
    mockDraftState = freshDraft({
      display_name: "Yann",
      neighborhood: "Cocody",
      date_of_birth: "2020-01-01",
    });
    const instance = render();
    const cta = instance.root.findByProps({ testID: "profile-continue" });
    expect(cta.props.disabled).toBe(true);
    // Message d'erreur inline visible.
    const tooYoung = (instance.root as unknown as {
      findAllByProps: (p: Record<string, unknown>) => { props: Record<string, unknown> }[];
    }).findAllByProps({ testID: "profile-dob-too-young" });
    expect(tooYoung.length).toBeGreaterThan(0);
  });

  it("Story 4.8 — tap sur le déclencheur DOB affiche le DateTimePicker", () => {
    mockDraftState = freshDraft();
    const instance = render();
    // Pre-tap : pas de picker rendu.
    const before = (instance.root as unknown as {
      findAllByProps: (p: Record<string, unknown>) => { props: Record<string, unknown> }[];
    }).findAllByProps({ testID: "profile-dob-picker" });
    expect(before.length).toBe(0);
    // Tap déclencheur.
    const trigger = instance.root.findByProps({ testID: "profile-dob-trigger" });
    TestRenderer.act(() => {
      (trigger.props.onPress as () => void)();
    });
    // Post-tap : picker rendu.
    const after = (instance.root as unknown as {
      findAllByProps: (p: Record<string, unknown>) => { props: Record<string, unknown> }[];
    }).findAllByProps({ testID: "profile-dob-picker" });
    expect(after.length).toBeGreaterThan(0);
  });

  it("country_code default CI sélectionné au mount", () => {
    const instance = render();
    // findAll : le testID est propagé du wrapper Choice vers la Pressable
    // interne. On cible le nœud qui expose la prop a11y `accessibilityState`
    // (le Pressable lui-même).
    const all = (instance.root as unknown as {
      findAllByProps: (p: Record<string, unknown>) => { props: Record<string, unknown> }[];
    }).findAllByProps({ testID: "profile-country-CI" });
    const ciChoice =
      all.find((n) => n.props.accessibilityState !== undefined) ?? all[all.length - 1]!;
    expect(ciChoice.props.accessibilityState).toMatchObject({ selected: true });
  });

  it("pre-fill display_name depuis draft est respecté", () => {
    mockDraftState = freshDraft({ display_name: "Vanessa" });
    const instance = render();
    const input = instance.root.findByProps({ testID: "profile-name" });
    expect(input.props.value).toBe("Vanessa");
  });

  it("tap origin-NG met à jour origin_country_code via mockSetField", () => {
    const instance = render();
    const ng = instance.root.findByProps({ testID: "profile-origin-NG" });
    TestRenderer.act(() => {
      (ng.props.onPress as () => void)();
    });
    expect(mockSetField).toHaveBeenCalledWith("origin_country_code", "NG" satisfies CountryCode);
  });

  it("tap gender femme met à jour gender", () => {
    const instance = render();
    const femme = instance.root.findByProps({ testID: "profile-gender-femme" });
    TestRenderer.act(() => {
      (femme.props.onPress as () => void)();
    });
    expect(mockSetField).toHaveBeenCalledWith("gender", "femme" satisfies Gender);
  });
});
