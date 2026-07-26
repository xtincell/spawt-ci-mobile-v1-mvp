// Story 2.6 — AC #8-2 : PalaisRevealScreen — emit onboarding_completed + finalize + nav.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

import type { OnboardingDraft } from "../../src/types/spawter";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockReplace = jest.fn();
// P-21 round 3 — Capture les `options` passées à `<Stack.Screen>` pour pouvoir
// assert sur `gestureEnabled` (sans ça, le mock `() => null` rend impossible
// la vérification de P-24 — régression silencieuse).
const mockStackScreen: jest.Mock<null, [Record<string, unknown>]> = jest.fn(
  (_props: Record<string, unknown>) => null,
);
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  // P-24 — palais-reveal monte un <Stack.Screen options={{ gestureEnabled }} />
  // pour désactiver le swipe-back iOS pendant finalize.
  Stack: { Screen: (props: Record<string, unknown>) => mockStackScreen(props) },
}));

const mockTrack = jest.fn();
jest.mock("../../src/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

let mockDraft: OnboardingDraft;
const mockFinalize = jest.fn(() => Promise.resolve());

jest.mock("../../src/store/onboarding-draft", () => ({
  useOnboardingDraft: (selector: (s: { draft: OnboardingDraft }) => unknown) =>
    selector({ draft: mockDraft }),
}));

jest.mock("../../src/store/spawter-store", () => ({
  useSpawterStore: (selector: (s: { finalizeOnboarding: typeof mockFinalize }) => unknown) =>
    selector({ finalizeOnboarding: mockFinalize }),
}));

jest.mock("expo-linear-gradient", () => {
  const { View } = jest.requireActual("react-native");
  return {
    LinearGradient: ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) => (
      <View {...rest}>{children}</View>
    ),
  };
});

jest.mock("../../src/components/ChatBubble", () => ({
  ChatBubble: () => null,
}));

// Chantier 13 archétypes — palais-reveal anime la carte d'archétype
// (FadeInDown). Mock reanimated : pas de partie native en jest (même pattern
// que GuetIndicator.test.tsx).
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    FadeInDown: { duration: () => ({}) },
    View,
  };
});

jest.mock("../../src/components/primitives/PalaisRadar", () => ({
  PalaisRadar: () => null,
}));

import PalaisRevealScreen from "../../app/(onboarding)/palais-reveal";

interface FoundProps {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => FoundProps;
  };
}

function freshDraft(over: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    phone_e164: "+22507000000",
    display_name: "Yann",
    email: null,
    neighborhood: "Cocody",
    country_code: "CI",
    origin_country_code: "CI",
    gender: "femme",
    // Story 4.8 — date_of_birth précise (remplace `age_range` figé du draft).
    // 1995-06-15 → 30 ans à today=2026-05-21 → derivedAgeRange = "25-34".
    date_of_birth: "1995-06-15",
    consent: { cgv_accepted_at: "iso", geoloc_consent_at: "iso" },
    calibration_answers: {
      racines_horizons: -0.4,
      taniere_nomade: 0.4,
      exigeant_enthousiaste: 0,
      foule_secret: 0.4,
      maquis_table: -0.4,
    },
    started_at: Date.now() - 120_000,
    // Chantier 13 archétypes — pas d'héritage quiz par défaut dans les tests.
    meute_heritage: null,
    ...over,
  };
}

function render(): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(<PalaisRevealScreen />) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("no renderer");
  return raw;
}

describe("<PalaisRevealScreen /> — Story 2.6", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
    mockReplace.mockClear();
    mockTrack.mockClear();
    mockFinalize.mockClear();
    mockStackScreen.mockClear();
    mockDraft = freshDraft();
  });

  it("rend le CTA continuer", () => {
    const instance = render();
    const cta = instance.root.findByProps({ testID: "palais-reveal-continue" });
    expect(cta).toBeTruthy();
  });

  it("tap continuer → track(onboarding_completed) + finalize + router.replace((tabs))", async () => {
    const instance = render();
    const cta = instance.root.findByProps({ testID: "palais-reveal-continue" });
    await TestRenderer.act(async () => {
      await (cta.props.onPress as () => Promise<void>)();
    });

    const completedCall = mockTrack.mock.calls.find(
      ([e]) => (e as { name: string }).name === "onboarding_completed",
    );
    expect(completedCall).toBeTruthy();
    const props = (completedCall?.[0] as {
      properties: {
        country_code: string;
        age_range: string;
        gender: string;
        time_to_complete_seconds: number;
        palais_initial_dominant_axes: readonly string[];
      };
    }).properties;
    expect(props.country_code).toBe("CI");
    expect(props.age_range).toBe("25-34");
    expect(props.gender).toBe("femme");
    expect(props.time_to_complete_seconds).toBeGreaterThanOrEqual(110);
    expect(props.palais_initial_dominant_axes.length).toBeGreaterThan(0);

    expect(mockFinalize).toHaveBeenCalledWith(mockDraft);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("started_at null → time_to_complete_seconds = -1 (sentinelle KPI)", async () => {
    // Post-P17 (code review 2026-05-17) : sentinel `-1` au lieu de `0` quand
    // started_at est null, pour ne pas polluer la funnel KPI Kidam avec un
    // faux zéro.
    mockDraft = freshDraft({ started_at: null });
    const instance = render();
    const cta = instance.root.findByProps({ testID: "palais-reveal-continue" });
    await TestRenderer.act(async () => {
      await (cta.props.onPress as () => Promise<void>)();
    });
    const call = mockTrack.mock.calls.find(
      ([e]) => (e as { name: string }).name === "onboarding_completed",
    );
    const props = (call?.[0] as { properties: { time_to_complete_seconds: number } }).properties;
    expect(props.time_to_complete_seconds).toBe(-1);
  });

  it("finalize throw → error visible + pas de navigation + onboarding_completed NON émis", async () => {
    // P-22 round 3 — Le track `onboarding_completed` doit être émis APRÈS le
    // succès de `finalizeOnboarding`, jamais avant. Si finalize throw, le funnel
    // KPI Kidam ne doit PAS s'incrémenter (sinon décorrélation taux finalize
    // réel vs taux reporté).
    mockFinalize.mockRejectedValueOnce(new Error("BOOM"));
    const instance = render();
    const cta = instance.root.findByProps({ testID: "palais-reveal-continue" });
    await TestRenderer.act(async () => {
      await (cta.props.onPress as () => Promise<void>)();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    const completedCall = mockTrack.mock.calls.find(
      ([e]) => (e as { name: string }).name === "onboarding_completed",
    );
    expect(completedCall).toBeUndefined();
  });

  it("P-24 — Stack.Screen reçoit gestureEnabled=true au mount (pas en submitting)", () => {
    // P-21 round 3 — Sans ce test, P-24 régresse silencieusement (le mock
    // précédent rendait null sans capturer `options`).
    render();
    expect(mockStackScreen).toHaveBeenCalled();
    const lastCall = mockStackScreen.mock.calls.at(-1)?.[0] as
      | { options?: { gestureEnabled?: boolean } }
      | undefined;
    expect(lastCall?.options?.gestureEnabled).toBe(true);
  });
});
