import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useFrameCallback, useSharedValue } from "react-native-reanimated";

import sprites from "../../../assets/brand/window-opening.sprites.json";
import { advanceWindowClock, windowFrameAt, WINDOW_POSE_MS } from "./window-opening-motion";

const firstSheet = require("../../../assets/brand/window-opening.sheet-0.png");
const secondSheet = require("../../../assets/brand/window-opening.sheet-1.png");
const firstPose = require("../../../assets/brand/window-opening.first.png");
const finalPose = require("../../../assets/brand/window-opening.final.png");
const fallback = require("../../../assets/brand/window-repere.png");
const frameWidth = sprites.frameWidth / sprites.pixelRatio;
const frameHeight = sprites.frameHeight / sprites.pixelRatio;
const columns = sprites.columns;
const capacity = sprites.framesPerSheet;
const frameStyle = { ...StyleSheet.absoluteFillObject, width: frameWidth, height: frameHeight };

interface Props { animate: boolean; staticPose?: boolean; onDone: () => void; onReady?: (() => void) | undefined }

/** Les images V2 se déplacent sur le thread UI, sans rendu React par image. */
export function WindowOpeningMark({ animate, staticPose = false, onDone, onReady }: Props) {
  const { width, height } = useWindowDimensions();
  const [loaded, setLoaded] = useState(0);
  const [poseLoaded, setPoseLoaded] = useState(false);
  const [paintReady, setPaintReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const callbacks = useRef({ onDone, onReady }); callbacks.current = { onDone, onReady };
  const alive = useRef(true);
  const readySent = useRef(false);
  const doneSent = useRef(false);
  const elapsed = useSharedValue(0);
  const frame = useSharedValue(0);
  const completed = useSharedValue(false);
  const ready = useCallback(() => {
    if (alive.current && !readySent.current) {
      readySent.current = true;
      callbacks.current.onReady?.();
    }
  }, []);
  const done = useCallback(() => {
    if (alive.current && !doneSent.current) { doneSent.current = true; callbacks.current.onDone(); }
  }, []);
  const fail = useCallback(() => { setFailed(true); ready(); done(); }, [ready, done]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const tick = useCallback<Parameters<typeof useFrameCallback>[0]>((info) => {
    "worklet";
    if (completed.value) return;
    // Une frame UI tardive ralentit la séquence au lieu de sauter son clin d’œil.
    elapsed.value = advanceWindowClock(elapsed.value, info.timeSincePreviousFrame ?? 0);
    frame.value = windowFrameAt(elapsed.value);
    if (elapsed.value >= WINDOW_POSE_MS) {
      completed.value = true;
      runOnJS(done)();
    }
  }, [completed, elapsed, frame, done]);
  const clock = useFrameCallback(tick, false);
  useEffect(() => {
    clock.setActive(false);
    if (staticPose) { frame.value = sprites.frames - 1; return; }
    if (animate && paintReady && !failed && !doneSent.current) clock.setActive(true);
  }, [animate, paintReady, failed, staticPose, clock, frame]);

  useEffect(() => {
    if (!poseLoaded || (loaded !== 3 && !staticPose)) return;
    ready();
    let second: number | null = null;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPaintReady(true));
    });
    return () => { cancelAnimationFrame(first); if (second !== null) cancelAnimationFrame(second); };
  }, [loaded, poseLoaded, staticPose, ready]);
  useEffect(() => {
    if (paintReady || failed || staticPose) return;
    // Ce délai couvre aussi un chargement qui garde le splash système.
    const timer = setTimeout(fail, 4000);
    return () => clearTimeout(timer);
  }, [paintReady, failed, staticPose, fail]);
  useEffect(() => {
    if (!animate || !paintReady || failed || staticPose) return;
    const timer = setTimeout(() => { if (!doneSent.current) fail(); }, 5000);
    return () => clearTimeout(timer);
  }, [animate, paintReady, failed, staticPose, fail]);

  const firstStyle = useAnimatedStyle(() => {
    const local = Math.min(frame.value, capacity - 1);
    return { opacity: frame.value < capacity ? 1 : 0,
      transform: [{ translateX: -(local % columns) * frameWidth }, { translateY: -Math.floor(local / columns) * frameHeight }] };
  });
  const secondStyle = useAnimatedStyle(() => {
    const local = Math.max(0, frame.value - capacity);
    return { opacity: frame.value >= capacity ? 1 : 0,
      transform: [{ translateX: -(local % columns) * frameWidth }, { translateY: -Math.floor(local / columns) * frameHeight }] };
  });
  const portraitOffset = Platform.OS === "android" ? 0 : (241.5 - 175) * .49;
  return (
    <View style={{ width, height }} testID="spawt-window-mark" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View pointerEvents="none" style={{ position: "absolute", left: (width - frameWidth) / 2, top: (height - frameHeight) / 2 + portraitOffset, width: frameWidth, height: frameHeight, overflow: "hidden" }}>
        {!staticPose && !failed ? <>
          <Animated.Image source={firstSheet} fadeDuration={0} resizeMode="stretch" resizeMethod="scale"
            onLoad={() => setLoaded(value => value | 1)} onError={fail} style={[styles.sheet, firstStyle]} testID="spawt-opening-sheet-0" />
          <Animated.Image source={secondSheet} fadeDuration={0} resizeMode="stretch" resizeMethod="scale"
            onLoad={() => setLoaded(value => value | 2)} onError={fail} style={[styles.sheet, secondStyle]} testID="spawt-opening-sheet-1" />
        </> : null}
        {staticPose || failed || !paintReady ? (
          <Image source={failed ? fallback : staticPose ? finalPose : firstPose} fadeDuration={0} resizeMode="stretch"
            onLoad={() => { setPoseLoaded(true); if (failed || staticPose) ready(); }} onError={fail}
            style={frameStyle} testID="spawt-opening-pose" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 0, top: 0, width: frameWidth * columns, height: frameHeight * sprites.rows },
});
