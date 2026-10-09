import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Platform, View, useWindowDimensions } from "react-native";

import atlas from "../../../assets/brand/window-opening.atlas.json";
import { advanceWindowClock, windowFrameAt, WINDOW_POSE_MS } from "./window-opening-motion";

const artwork = require("../../../assets/brand/window-opening.atlas.png");
const fallback = require("../../../assets/brand/window-repere.png");
const frameWidth = atlas.frameWidth / atlas.pixelRatio;
const frameHeight = atlas.frameHeight / atlas.pixelRatio;

interface Props { animate: boolean; staticPose?: boolean; onDone: () => void; onReady?: (() => void) | undefined }

/** Images exactes du pack V2, avec une position réellement commitée par React Native. */
export function WindowOpeningMark({ animate, staticPose = false, onDone, onReady }: Props) {
  const { width, height } = useWindowDimensions();
  const [frame, setFrame] = useState(staticPose ? atlas.frames - 1 : 0);
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
    if (staticPose) { setFrame(atlas.frames - 1); return; }
    setFrame(0);
    let pending = 0;
    let active = true;
    if (animate && loaded && !failed) {
      let elapsed = 0;
      let previous: number | undefined;
      const tick = (now: number) => {
        if (!active) return;
        if (previous !== undefined) elapsed = advanceWindowClock(elapsed, now - previous);
        previous = now;
        setFrame(windowFrameAt(elapsed / 1000));
        if (elapsed >= WINDOW_POSE_MS) done();
        else pending = requestAnimationFrame(tick);
      };
      pending = requestAnimationFrame(tick);
    }
    return () => { active = false; cancelAnimationFrame(pending); };
  }, [animate, staticPose, loaded, failed, done]);
  // Le PNG/MP4 est composé autour de y=175 ; le masque Android centre le
  // repère entier à y=241,5. Conserver le raccord et la taille de 140 dp.
  const portraitOffset = Platform.OS === "android" ? 0 : (241.5 - 175) * .49;
  return (
    <View style={{ width, height }} testID="spawt-window-mark" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: "absolute", left: (width - frameWidth) / 2, top: (height - frameHeight) / 2 + portraitOffset, width: frameWidth, height: frameHeight, overflow: "hidden" }}>
        {failed ? <Image source={fallback} resizeMode="contain" style={{ width: frameWidth, height: frameHeight }} /> : (
          <Image source={artwork} fadeDuration={0} resizeMode="stretch" resizeMethod="scale" onLoad={imageReady} onError={imageFailed}
            style={{ position: "absolute", left: -(frame % atlas.columns) * frameWidth, top: -Math.floor(frame / atlas.columns) * frameHeight,
              width: frameWidth * atlas.columns, height: frameHeight * atlas.rows }} />
        )}
      </View>
    </View>
  );
}
