import React from "react";
import TestRenderer from "react-test-renderer";
import { StyleSheet } from "react-native";

const mockListeners = new Map<string, () => void>();
const mockPlayer = {
  status: "readyToPlay", play: jest.fn(), pause: jest.fn(),
  addListener: jest.fn((event: string, callback: () => void) => {
    mockListeners.set(event, callback);
    return { remove: () => mockListeners.delete(event) };
  }),
};
let mockStatus = "readyToPlay";
jest.mock("expo", () => ({ useEvent: () => ({ status: mockStatus }) }));
jest.mock("expo-video", () => {
  const ReactMock = jest.requireActual("react") as typeof import("react");
  const { View } = jest.requireActual("react-native") as typeof import("react-native");
  return {
    useVideoPlayer: () => mockPlayer,
    VideoView: (props: Record<string, unknown>) => ReactMock.createElement(View, props),
  };
});
import { WindowOpeningMark } from "../../src/components/brand/WindowOpeningMark";

describe("lecteur natif de l’ouverture fournie", () => {
  let instance: TestRenderer.ReactTestRenderer;
  const ready = jest.fn(), done = jest.fn();
  const render = (animate = false, staticPose = false) => {
    TestRenderer.act(() => {
      instance = TestRenderer.create(<WindowOpeningMark animate={animate} staticPose={staticPose} onReady={ready} onDone={done} />);
    });
  };
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockListeners.clear(); mockStatus = "readyToPlay"; });
  afterEach(() => { TestRenderer.act(() => instance?.unmount()); jest.useRealTimers(); });

  it("attend le retrait du splash puis lit le mouvement, avec un seul rappel de fin", () => {
    render();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(instance.root.findByProps({ testID: "spawt-opening-pose" }).props.style)).toMatchObject({ width: 200, height: 320 });
    expect(StyleSheet.flatten(instance.root.findByProps({ testID: "spawt-opening-video" }).props.style)).toMatchObject({ width: 200, height: 320 });
    TestRenderer.act(() => instance.root.findByProps({ testID: "spawt-opening-pose" }).props.onLoad());
    expect(ready).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => instance.root.findByProps({ testID: "spawt-opening-video" }).props.onFirstFrameRender());
    expect(ready).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => jest.advanceTimersByTime(40));
    TestRenderer.act(() => instance.update(<WindowOpeningMark animate onReady={ready} onDone={done} />));
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => { mockListeners.get("playToEnd")?.(); mockListeners.get("playToEnd")?.(); });
    expect(done).not.toHaveBeenCalled();
    expect(instance.root.findByProps({ testID: "spawt-opening-pose" })).toBeTruthy();
    TestRenderer.act(() => instance.root.findByProps({ testID: "spawt-opening-pose" }).props.onLoad());
    expect(done).toHaveBeenCalledTimes(1);
    expect(instance.root.findAllByProps({ testID: "spawt-opening-video" })).toHaveLength(0);
    TestRenderer.act(() => instance.root.findByProps({ testID: "spawt-opening-pose" }).props.onLoad());
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("ne démarre pas avec le seul poster lorsque le splash a déjà été retiré", () => {
    render(true);
    TestRenderer.act(() => instance.root.findByProps({ testID: "spawt-opening-pose" }).props.onLoad());
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(ready).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => instance.root.findByProps({ testID: "spawt-opening-video" }).props.onFirstFrameRender());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    TestRenderer.act(() => jest.advanceTimersByTime(40));
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });
  it("signale la disponibilité et termine même si le décodeur refuse la vidéo", () => {
    mockStatus = "error";
    render(true);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(instance.root.findAllByProps({ testID: "spawt-opening-video" })).toHaveLength(0);
  });
  it("évite un écran bloqué si aucune première image vidéo n’est reçue", () => {
    render(true);
    TestRenderer.act(() => jest.advanceTimersByTime(4000));
    expect(ready).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("ne consomme pas le délai de préparation derrière le splash natif", () => {
    render();
    TestRenderer.act(() => jest.advanceTimersByTime(5000));
    expect(done).not.toHaveBeenCalled();
    TestRenderer.act(() => instance.update(<WindowOpeningMark animate onReady={ready} onDone={done} />));
    TestRenderer.act(() => jest.advanceTimersByTime(4000));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("libère la route si le lecteur commence mais ne signale jamais sa fin", () => {
    render(true);
    TestRenderer.act(() => instance.root.findByProps({ testID: "spawt-opening-video" }).props.onFirstFrameRender());
    TestRenderer.act(() => jest.advanceTimersByTime(40));
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    TestRenderer.act(() => jest.advanceTimersByTime(5000));
    expect(done).toHaveBeenCalledTimes(1);
    expect(instance.root.findAllByProps({ testID: "spawt-opening-video" })).toHaveLength(0);
  });
  it("arrête le lecteur et montre la pose finale après passage ou réduction des mouvements", () => {
    render(true);
    const pauses = mockPlayer.pause.mock.calls.length;
    TestRenderer.act(() => instance.update(<WindowOpeningMark animate={false} staticPose onReady={ready} onDone={done} />));
    expect(mockPlayer.pause.mock.calls.length).toBeGreaterThan(pauses);
    expect(instance.root.findAllByProps({ testID: "spawt-opening-video" })).toHaveLength(0);
    expect(instance.root.findByProps({ testID: "spawt-opening-pose" })).toBeTruthy();
  });
});
