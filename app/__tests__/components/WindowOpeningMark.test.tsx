import React from "react";
import TestRenderer from "react-test-renderer";
import { StyleSheet } from "react-native";

let mockTick: ((info: { timeSincePreviousFrame: number | null }) => void) | undefined;
const mockClock = { isActive: false, callbackId: 1, setActive: jest.fn((active: boolean) => { mockClock.isActive = active; }) };
jest.mock("react-native-reanimated", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const RN = jest.requireActual("react-native") as typeof import("react-native");
  return {
    __esModule: true, default: { Image: RN.Image },
    useSharedValue: (value: unknown) => ReactMock.useRef({ value }).current,
    useAnimatedStyle: (callback: () => unknown) => callback(),
    useFrameCallback: (callback: typeof mockTick) => { mockTick = callback; return mockClock; },
    runOnJS: (callback: () => void) => callback,
  };
});
import { WindowOpeningMark } from "../../src/components/brand/WindowOpeningMark";

describe("images V2 sur le thread UI", () => {
  let instance: TestRenderer.ReactTestRenderer;
  const ready = jest.fn(), done = jest.fn();
  const render = (animate = false, staticPose = false) => TestRenderer.act(() => {
    instance = TestRenderer.create(<WindowOpeningMark animate={animate} staticPose={staticPose} onReady={ready} onDone={done} />);
  });
  const load = (id: string) => TestRenderer.act(() => instance.root.findByProps({ testID: id }).props.onLoad());
  const preload = () => { load("spawt-opening-pose"); load("spawt-opening-sheet-0"); load("spawt-opening-sheet-1"); TestRenderer.act(() => jest.advanceTimersByTime(40)); };
  const tick = (delta = 1000 / 60) => TestRenderer.act(() => { if (mockClock.isActive) mockTick?.({ timeSincePreviousFrame: delta }); });
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockClock.isActive = false; mockTick = undefined; });
  afterEach(() => { TestRenderer.act(() => instance?.unmount()); jest.useRealTimers(); });

  it("attend les deux textures, leur poster et le retrait du splash avant le mouvement", () => {
    render();
    expect(StyleSheet.flatten(instance.root.findByProps({ testID: "spawt-opening-pose" }).props.style)).toMatchObject({ width: 200, height: 320 });
    load("spawt-opening-pose"); load("spawt-opening-sheet-0");
    expect(ready).not.toHaveBeenCalled();
    load("spawt-opening-sheet-1");
    expect(ready).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => jest.advanceTimersByTime(40));
    expect(mockClock.isActive).toBe(false);
    TestRenderer.act(() => instance.update(<WindowOpeningMark animate onReady={ready} onDone={done} />));
    expect(mockClock.isActive).toBe(true);
    for (let i = 0; i < 80; i++) tick();
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("termine une seule fois avec le dernier callback, sans rejouer au rerender", () => {
    render(true); preload();
    for (let i = 0; i < 40; i++) tick();
    const current = jest.fn();
    TestRenderer.act(() => instance.update(<WindowOpeningMark animate onReady={ready} onDone={current} />));
    for (let i = 0; i < 40; i++) tick();
    expect(done).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => jest.advanceTimersByTime(6000));
    expect(instance.root.findAllByProps({ testID: "spawt-opening-sheet-0" }).length).toBeGreaterThan(0);
    expect(current).toHaveBeenCalledTimes(1);
  });
  it("libère le splash même si une texture ne termine jamais son chargement", () => {
    render();
    load("spawt-opening-pose");
    TestRenderer.act(() => jest.advanceTimersByTime(4000));
    expect(ready).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(mockClock.isActive).toBe(false);
  });
  it("garde la route accessible après une erreur de chargement", () => {
    render(true);
    TestRenderer.act(() => instance.root.findByProps({ testID: "spawt-opening-sheet-1" }).props.onError());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(mockClock.isActive).toBe(false);
  });
  it("libère la route si le moteur UI ne signale jamais sa fin", () => {
    render(true); preload();
    TestRenderer.act(() => jest.advanceTimersByTime(5000));
    expect(done).toHaveBeenCalledTimes(1);
    expect(mockClock.isActive).toBe(false);
  });
  it("interrompt le mouvement avec la pose finale après passage ou réduction des animations", () => {
    render(true); preload(); tick();
    TestRenderer.act(() => instance.update(<WindowOpeningMark animate={false} staticPose onReady={ready} onDone={done} />));
    expect(mockClock.isActive).toBe(false);
    expect(instance.root.findByProps({ testID: "spawt-opening-pose" })).toBeTruthy();
    load("spawt-opening-pose");
    expect(ready).toHaveBeenCalledTimes(1);
  });
});
