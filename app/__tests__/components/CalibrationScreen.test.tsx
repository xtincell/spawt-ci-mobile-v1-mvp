// Story 2.5 — AC #7 : CalibrationScreen séquence 5 questions + push palais-reveal.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

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

describe("<CalibrationScreen /> — Story 2.5", () => {
  beforeEach(() => {
    mockTranslate.mockClear();
    mockPush.mockClear();
    mockTrack.mockClear();
    mockSetCalibration.mockClear();
  });

  it("au mount : grille rendue pour la 1re question", () => {
    const instance = render();
    expect(instance.root.findByProps({ testID: "calibration-grid" })).toBeTruthy();
    const next = instance.root.findByProps({ testID: "calibration-next" });
    expect(next).toBeTruthy();
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

  it("sélection 2 cartes neg sur Q1 puis Next → event direction=neg value=-0.4", () => {
    const instance = render();
    const q1 = CALIBRATION_QUESTIONS[0]!;
    const negCards = q1.cards.filter((c) => c.polarity === "neg").slice(0, 2);

    for (const card of negCards) {
      const cardEl = instance.root.findByProps({
        testID: `calibration-card-${q1.axis}-${card.altKey}`,
      });
      TestRenderer.act(() => {
        (cardEl.props.onToggle as () => void)();
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
});
