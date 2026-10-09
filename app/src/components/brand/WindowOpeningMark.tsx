import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Platform, View, useWindowDimensions } from "react-native";
import Reanimated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import atlas from "../../../assets/brand/window-opening.atlas.json";
import { windowFrameAt, WINDOW_POSE_MS } from "./window-opening-motion";

const artwork = require("../../../assets/brand/window-opening.atlas.png");
const fallback = require("../../../assets/brand/window-repere.png");
const frameWidth = atlas.frameWidth / atlas.pixelRatio;
const frameHeight = atlas.frameHeight / atlas.pixelRatio;

interface Props { animate: boolean; staticPose?: boolean; onDone: () => void; onReady?: (() => void) | undefined }

/** Images exactes du pack V2 ; déplacement de la texture sur le thread UI. */
export function WindowOpeningMark({ animate, staticPose = false, onDone, onReady }: Props) {
  const { width, height } = useWindowDimensions();
  const clock = useSharedValue(staticPose ? 1.14 : 0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const callbacks = useRef({ onDone, onReady }); callbacks.current = { onDone, onReady };
  const readySent = useRef(false);
  const done = useCallback(() => callbacks.current.onDone(), []);
  const imageReady = useCallback(() => {
    setLoaded(true);
    if (!readySent.current) {
      readySent.current = true;
      callbacks.current.onReady?.();
    }
  }, []);
  const imageFailed = useCallback(() => {
    setFailed(true);
    imageReady();
    done();
  }, [imageReady, done]);

  useEffect(() => {
    cancelAnimation(clock);
    if (staticPose) { clock.value = 1.14; return; }
    clock.value = 0;
    if (animate && loaded && !failed) {
      clock.value = withTiming(1.14, { duration: WINDOW_POSE_MS, easing: Easing.linear }, finished => {
        if (finished) runOnJS(done)();
      });
    }
    return () => cancelAnimation(clock);
  }, [animate, staticPose, loaded, failed, clock, done]);

  const imageStyle = useAnimatedStyle(() => {
    const frame = windowFrameAt(clock.value);
    return { transform: [
      { translateX: -(frame % atlas.columns) * frameWidth },
      { translateY: -Math.floor(frame / atlas.columns) * frameHeight },
    ] };
  });
  // Le PNG/MP4 est composé autour de y=175 ; le masque Android centre le
  // repère entier à y=241,5. Conserver le raccord et la taille de 140 dp.
  const portraitOffset = Platform.OS === "android" ? 0 : (241.5 - 175) * .49;
  return (
    <View style={{ width, height }} testID="spawt-window-mark" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: "absolute", left: (width - frameWidth) / 2, top: (height - frameHeight) / 2 + portraitOffset, width: frameWidth, height: frameHeight, overflow: "hidden" }}>
        {failed ? <Image source={fallback} resizeMode="contain" style={{ width: frameWidth, height: frameHeight }} /> : (
          <Reanimated.Image source={artwork} fadeDuration={0} resizeMode="stretch" resizeMethod="scale" onLoad={imageReady} onError={imageFailed}
            style={[{ width: frameWidth * atlas.columns, height: frameHeight * atlas.rows }, imageStyle]} />
        )}
      </View>
    </View>
  );
}
