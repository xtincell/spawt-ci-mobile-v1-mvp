import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";
import { AccessibilityInfo } from "react-native";

// RN désactive les animations sous Jest par défaut : garder le vrai moteur
// JS avec fake timers pour vérifier délais, interruptions et rerenders.
jest.mock("react-native/Libraries/Utilities/Platform", () => {
  const actual = jest.requireActual("react-native/Libraries/Utilities/Platform").default;
  return { __esModule: true, default: { ...actual, OS: "web", isDisableAnimations: false } };
});

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// La coordination de route utilise la durée du pack ; les images réellement
// affichées sont vérifiées dans la vidéo ADB de l’APK Android.
jest.mock("../../src/components/brand/WindowOpeningMark", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const { View } = jest.requireActual("react-native") as typeof import("react-native");
  return { WindowOpeningMark: ({ animate, staticPose, onDone }: { animate: boolean; staticPose: boolean; onDone: () => void }) => {
    ReactMock.useEffect(() => {
      if (!animate) return;
      const timer = setTimeout(onDone, 1150);
      return () => clearTimeout(timer);
    }, [animate, onDone]);
    return ReactMock.createElement(View, { testID: "spawt-window-mark", ...{ animate, staticPose } });
  } };
});
jest.mock("expo-linear-gradient", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    LinearGradient: ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
      ReactMock.createElement(RNMock.View, rest, children),
  };
});

import { AppOpening } from "../../src/components/brand/AppOpening";

interface Renderer {
  root: {
    findByProps: (props: Record<string, unknown>) => { props: Record<string, unknown> };
    findAllByProps: (props: Record<string, unknown>) => unknown[];
  };
  update: (node: ReactNode) => void;
  unmount: () => void;
}
let renderers: Renderer[] = [];

async function render(onFinished: () => void, ready = true): Promise<Renderer> {
  let raw: Renderer | null = null;
  await TestRenderer.act(async () => {
    raw = TestRenderer.create(<AppOpening onFinished={onFinished} ready={ready} />) as Renderer;
  });
  if (!raw) throw new Error("renderer did not initialize");
  renderers.push(raw);
  return raw;
}
function advance(ms: number) {
  for (let time = 0; time < ms; time += 100) {
    TestRenderer.act(() => { jest.advanceTimersByTime(Math.min(100, ms - time)); });
  }
}
function skip(instance: Renderer) {
  TestRenderer.act(() => {
    (instance.root.findByProps({ testID: "app-opening-skip" }).props.onPress as () => void)();
  });
}

describe("AppOpening — durée stable et transition sûre", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
  });
  afterEach(() => {
    TestRenderer.act(() => { for (const instance of renderers) instance.unmount(); });
    renderers = [];
    TestRenderer.act(() => { jest.runOnlyPendingTimers(); });
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("rend le logo animé et permet de passer avec un seul rappel de fin", async () => {
    const finished = jest.fn();
    const instance = await render(finished);
    expect(instance.root.findByProps({ testID: "spawt-window-mark" })).toBeTruthy();
    skip(instance);
    advance(300);
    skip(instance);
    advance(1000);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("termine en moins de 3,5 s malgré les rerenders du parent et utilise son dernier callback", async () => {
    const initial = jest.fn();
    const current = jest.fn();
    const instance = await render(initial);
    for (let i = 0; i < 35; i += 1) {
      TestRenderer.act(() => {
        instance.update(<AppOpening onFinished={() => current()} />);
      });
      advance(100);
    }
    expect(initial).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
  });

  it("garde la transition au-dessus de l'accueil tant que la route du compte n'est pas prête", async () => {
    const finished = jest.fn();
    const instance = await render(finished, false);
    advance(4000);
    expect(finished).not.toHaveBeenCalled();
    TestRenderer.act(() => {
      instance.update(<AppOpening onFinished={finished} ready />);
    });
    advance(500);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("attend le retrait du splash natif avant de commencer sa séquence", async () => {
    const finished = jest.fn();
    let instance: Renderer | null = null;
    await TestRenderer.act(async () => {
      instance = TestRenderer.create(<AppOpening start={false} onFinished={finished} />) as Renderer;
    });
    if (!instance) throw new Error("renderer did not initialize");
    const opening = instance as Renderer;
    renderers.push(opening);
    expect(opening.root.findByProps({ testID: "spawt-window-mark" }).props.animate).toBe(false);
    advance(5000);
    expect(finished).not.toHaveBeenCalled();
    TestRenderer.act(() => { opening.update(<AppOpening start onFinished={finished} />); });
    expect(opening.root.findByProps({ testID: "spawt-window-mark" }).props.animate).toBe(true);
    advance(1600);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("passer n'expose pas une route encore non restaurée", async () => {
    const finished = jest.fn();
    const instance = await render(finished, false);
    skip(instance);
    advance(1000);
    expect(finished).not.toHaveBeenCalled();
    TestRenderer.act(() => { instance.update(<AppOpening onFinished={finished} ready />); });
    advance(300);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("annule le rappel du fondu si l'overlay est démonté", async () => {
    const finished = jest.fn();
    const instance = await render(finished);
    skip(instance);
    advance(50);
    TestRenderer.act(() => instance.unmount());
    renderers = [];
    advance(1000);
    expect(finished).not.toHaveBeenCalled();
  });

  it("permet de passer même si la lecture de la préférence système tarde", async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(new Promise(() => {}));
    const finished = jest.fn();
    const instance = await render(finished);
    skip(instance);
    advance(300);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("respecte Réduire les animations avec la pose statique du pack", async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    const finished = jest.fn();
    const instance = await render(finished);
    expect(instance.root.findByProps({ testID: "spawt-window-mark" }).props).toMatchObject({ animate: false, staticPose: true });
    advance(100);
    expect(finished).toHaveBeenCalledTimes(1);
  });
});
