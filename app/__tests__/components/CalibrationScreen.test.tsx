// Story 2.5 — AC #7 : CalibrationScreen séquence 5 questions + push palais-reveal.
// Retour alpha R16 — Q1 (racines_horizons) se rend en Select multi, Q2-Q5
// gardent la grille de cartes.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

const mockTranslate = jest.fn((key: string) => key);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

// SafeAreaView (sheet du Select R16) : pas besoin de provider, on stube en
// View pure pour éviter le warning et garder le render simple.
jest.mock("react-native-safe-area-context", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    SafeAreaView: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
    SafeAreaProvider: ({ children }: { children: ReactNode }) =>
      ReactMock.createElement(RNMock.View, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTrack = jest.fn();
jest.mock("../../src/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

const mockSetCalibration = jest.fn();
jest.mock("../../src/store/onboarding-draft", () => {
  const fn = (selector: (s: { setCalibration: typeof mockSetCalibration }) => unknown) =>
    selector({ setCalibration: mockSetCalibration });
  return { useOnboardingDraft: fn };
});

jest.mock("../../src/components/ChatBubble", () => ({
  ChatBubble: () => null,
}));

import CalibrationScreen from "../../app/(onboarding)/calibration";
import { CALIBRATION_QUESTIONS } from "../../src/lib/calibration-mapping";

interface FoundProps {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => FoundProps;
    findAllByProps: (props: Record<string, unknown>) => FoundProps[];
  };
}

function render(): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(<CalibrationScreen />) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("no renderer");
  return raw;
}

// Le testID est propagé du composant wrapper (Select) vers la Pressable
// interne : on cible le nœud qui expose un `onPress` (la Pressable elle-même).
function findPressable(instance: TestRendererInstanceLike, testID: string): FoundProps {
  const all = instance.root.findAllByProps({ testID });
  return all.find((n) => typeof n.props.onPress === "function") ?? all[0]!;
}

describe("<CalibrationScreen /> — Story 2.5", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
    mockPush.mockClear();
    mockTrack.mockClear();
    mockSetCalibration.mockClear();
  });

  it("R16 — au mount : Q1 (racines_horizons) rendue en Select multi, pas en grille", () => {
    const instance = render();
    expect(
      instance.root.findAllByProps({ testID: "calibration-select-racines_horizons" }).length,
    ).toBeGreaterThan(0);
    expect(instance.root.findAllByProps({ testID: "calibration-grid" })).toHaveLength(0);
    const next = instance.root.findByProps({ testID: "calibration-next" });
    expect(next).toBeTruthy();
  });

  it("R16 — Q2 garde la grille de cartes après avoir passé Q1", () => {
    const instance = render();
    TestRenderer.act(() => {
      const next = instance.root.findByProps({ testID: "calibration-next" });
      (next.props.onPress as () => void)();
    });
    expect(
      instance.root.findAllByProps({ testID: "calibration-grid" }).length,
    ).toBeGreaterThan(0);
    expect(
      instance.root.findAllByProps({ testID: "calibration-select-racines_horizons" }),
    ).toHaveLength(0);
  });

  it("5 taps Next sans sélection → 5 events neutral + push palais-reveal au 5e", () => {
    const instance = render();

    for (let i = 0; i < CALIBRATION_QUESTIONS.length; i++) {
      TestRenderer.act(() => {
        const next = instance.root.findByProps({ testID: "calibration-next" });
        (next.props.onPress as () => void)();
      });
    }

    const answered = mockTrack.mock.calls.filter(
      ([e]) => (e as { name: string }).name === "calibration_answered",
    );
    expect(answered).toHaveLength(CALIBRATION_QUESTIONS.length);
    for (const call of answered) {
      const props = (call[0] as { properties: { direction: string; value: number } }).properties;
      expect(props.direction).toBe("neutral");
      expect(props.value).toBe(0);
    }

    expect(mockSetCalibration).toHaveBeenCalledTimes(CALIBRATION_QUESTIONS.length);
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/palais-reveal");

    const stepCompleted = mockTrack.mock.calls.find(
      ([e]) => (e as { name: string }).name === "onboarding_step_completed",
    );
    expect(stepCompleted).toBeTruthy();
    expect((stepCompleted?.[0] as { properties: { step: string } }).properties.step).toBe(
      "calibration",
    );
  });

  // P-26 — D-C path b : `Pas d'avis` (skip explicite) émet `skipped: true`
  // ET sentinel `value: null` (P-33) pour distinguer un skip d'un neutral.
  it("tap Pas d'avis (skip) → event skipped:true value:null + setCalibration(axis, null)", () => {
    const instance = render();
    const skipBtn = instance.root.findByProps({ testID: "calibration-skip" });
    expect(skipBtn).toBeTruthy();
    TestRenderer.act(() => {
      (skipBtn.props.onPress as () => void)();
    });
    const answered = mockTrack.mock.calls.find(
      ([e]) => (e as { name: string }).name === "calibration_answered",
    );
    expect(answered).toBeTruthy();
    const props = (answered?.[0] as {
      properties: { direction: string; value: number | null; skipped?: boolean };
    }).properties;
    expect(props.direction).toBe("neutral");
    expect(props.value).toBeNull();
    expect(props.skipped).toBe(true);
    // setCalibration appelé avec null (sentinel skip).
    expect(mockSetCalibration).toHaveBeenCalledWith(
      CALIBRATION_QUESTIONS[0]!.axis,
      null,
    );
  });

  it("R16 — sélection 2 options neg dans le Select Q1 puis Next → direction=neg value=-0.4", () => {
    const instance = render();
    const q1 = CALIBRATION_QUESTIONS[0]!;
    const negCards = q1.cards.filter((c) => c.polarity === "neg").slice(0, 2);

    // Ouvre la sheet du Select multi.
    const trigger = findPressable(instance, `calibration-select-${q1.axis}`);
    TestRenderer.act(() => {
      (trigger.props.onPress as () => void)();
    });

    for (const card of negCards) {
      const optionEl = findPressable(
        instance,
        `calibration-select-${q1.axis}-option-${card.altKey}`,
      );
      TestRenderer.act(() => {
        (optionEl.props.onPress as () => void)();
      });
    }

    TestRenderer.act(() => {
      const next = instance.root.findByProps({ testID: "calibration-next" });
      (next.props.onPress as () => void)();
    });

    const answered = mockTrack.mock.calls.find(
      ([e]) => (e as { name: string }).name === "calibration_answered",
    );
    expect(answered).toBeTruthy();
    expect((answered?.[0] as { properties: { direction: string; value: number } }).properties).toMatchObject({
      direction: "neg",
      value: -0.4,
    });
  });

  it("R16 — le toggle d'une option du Select coche/décoche (checkbox a11y)", () => {
    const instance = render();
    const q1 = CALIBRATION_QUESTIONS[0]!;
    const first = q1.cards[0]!;
    const optionTestID = `calibration-select-${q1.axis}-option-${first.altKey}`;

    const trigger = findPressable(instance, `calibration-select-${q1.axis}`);
    TestRenderer.act(() => {
      (trigger.props.onPress as () => void)();
    });

    expect(findPressable(instance, optionTestID).props.accessibilityRole).toBe("checkbox");
    expect(findPressable(instance, optionTestID).props.accessibilityState).toMatchObject({
      checked: false,
    });

    TestRenderer.act(() => {
      (findPressable(instance, optionTestID).props.onPress as () => void)();
    });
    expect(findPressable(instance, optionTestID).props.accessibilityState).toMatchObject({
      checked: true,
    });

    TestRenderer.act(() => {
      (findPressable(instance, optionTestID).props.onPress as () => void)();
    });
    expect(findPressable(instance, optionTestID).props.accessibilityState).toMatchObject({
      checked: false,
    });
  });
});
