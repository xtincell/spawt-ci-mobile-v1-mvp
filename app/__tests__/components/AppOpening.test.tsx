// R23 (build 8) — <AppOpening /> : ouverture animée à chaque lancement.
// Vérifie : (1) le rendu monte logo + overlay, (2) un TAP skippe (onFinished
// appelé après le fondu court), (3) la séquence complète finit d'elle-même.
//
// Fake timers : Animated (JS driver) planifie via timers — on les avance
// manuellement, et on démonte chaque renderer pour stopper les séquences.

import { type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react-test-renderer ships JS only
import TestRenderer from "react-test-renderer";

jest.mock("expo-linear-gradient", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RNMock = jest.requireActual("react-native") as typeof import("react-native");
  return {
    LinearGradient: ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
      ReactMock.createElement(RNMock.View, rest, children),
  };
});

import { AppOpening } from "../../src/components/brand/AppOpening";

interface TestInstanceLike {
  props: Record<string, unknown>;
}
interface TestRendererInstanceLike {
  root: { findByProps: (props: Record<string, unknown>) => TestInstanceLike };
  unmount: () => void;
}

let renderers: TestRendererInstanceLike[] = [];

function render(onFinished: () => void): TestRendererInstanceLike {
  let raw: TestRendererInstanceLike | null = null;
  TestRenderer.act(() => {
    raw = TestRenderer.create(
      <AppOpening onFinished={onFinished} />,
    ) as unknown as TestRendererInstanceLike;
  });
  if (!raw) throw new Error("renderer did not initialize");
  renderers.push(raw);
  return raw;
}

describe("<AppOpening /> — R23 ouverture animée à chaque lancement", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    TestRenderer.act(() => {
      for (const r of renderers) r.unmount();
    });
    renderers = [];
    TestRenderer.act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("monte l'overlay avec la zone skippable", () => {
    const onFinished = jest.fn();
    const instance = render(onFinished);
    expect(instance.root.findByProps({ testID: "app-opening" })).toBeTruthy();
    expect(instance.root.findByProps({ testID: "app-opening-skip" })).toBeTruthy();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("un tap skippe : onFinished appelé après le fondu court", () => {
    const onFinished = jest.fn();
    const instance = render(onFinished);
    const skip = instance.root.findByProps({ testID: "app-opening-skip" });
    TestRenderer.act(() => {
      (skip.props.onPress as () => void)();
    });
    TestRenderer.act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("la séquence complète se termine seule (jamais bloquante)", () => {
    const onFinished = jest.fn();
    render(onFinished);
    // Avance par pas : les effets React (logoDone → 2e séquence) ne flushent
    // qu'à la sortie de chaque act(), pas au milieu d'un run de timers.
    for (let i = 0; i < 12; i += 1) {
      TestRenderer.act(() => {
        jest.advanceTimersByTime(500);
      });
    }
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
