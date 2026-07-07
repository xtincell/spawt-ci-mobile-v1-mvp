// Story 2.2 — AC #7-5 : <SplashScreen /> rend les éléments wordmark + tagline
// + CTA et émet onboarding_started avant la nav.
//
// R15 — le splash est ANIMÉ (Animated.sequence au mount) : la suite tourne en
// fake timers ET démonte chaque renderer (le cleanup du useEffect appelle
// sequence.stop()). Sans ça, les timers de l'animation fuient au-delà de la
// suite et font échouer d'autres suites aléatoirement (flakiness observée).

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

const mockTranslate = jest.fn((key: string) => `[${key}]`);
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

// expo-linear-gradient : stub par un simple View pour éviter le natif.
jest.mock("expo-linear-gradient", () => {
  const { View } = jest.requireActual("react-native");
  return {
    LinearGradient: ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) => (
      <View {...rest}>{children}</View>
    ),
  };
});

import SplashScreen from "../../app/index";

interface TestInstanceLike {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: {
    findByProps: (props: Record<string, unknown>) => TestInstanceLike;
  };
  toJSON: () => unknown;
  unmount: () => void;
}

let renderers: TestRendererInstanceLike[] = [];

function render(): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(<SplashScreen />) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("renderer did not initialize");
  renderers.push(raw);
  return raw;
}

describe("<SplashScreen /> — Story 2.2 (gr-night + onboarding_started)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockTranslate.mockClear();
    mockPush.mockClear();
    mockTrack.mockClear();
  });

  afterEach(() => {
    // Démonte AVANT de purger les timers : le cleanup stoppe la séquence R15.
    TestRenderer.act(() => {
      for (const r of renderers) r.unmount();
    });
    renderers = [];
    TestRenderer.act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("rend le tree (wordmark + tagline + CTA via clés i18n)", () => {
    render();
    const keys = mockTranslate.mock.calls.map(([k]) => k);
    expect(keys).toContain("splash.tagline");
    expect(keys).toContain("splash.cta_start");
  });

  it("tap CTA → track(onboarding_started) émis AVANT router.push", () => {
    const instance = render();
    const cta = instance.root.findByProps({ testID: "splash-start" });
    TestRenderer.act(() => {
      (cta.props.onPress as () => void)();
    });

    expect(mockTrack).toHaveBeenCalledWith({ name: "onboarding_started", properties: {} });
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/consent");

    const trackOrder = mockTrack.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const pushOrder = mockPush.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY;
    expect(trackOrder).toBeLessThan(pushOrder);
  });
});
