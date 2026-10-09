import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Platform, StyleSheet, View, useWindowDimensions } from "react-native";

import media from "../../../assets/brand/window-opening.media.json";

const video = require("../../../assets/brand/window-opening.native.mp4");
const firstPose = require("../../../assets/brand/window-opening.first.png");
const finalPose = require("../../../assets/brand/window-opening.final.png");
const frameWidth = media.width / media.pixelRatio;
const frameHeight = media.height / media.pixelRatio;

interface Props { animate: boolean; staticPose?: boolean; onDone: () => void; onReady?: (() => void) | undefined }

/** Lecture native du mouvement fourni ; les poses de secours restent locales. */
export function WindowOpeningMark({ animate, staticPose = false, onDone, onReady }: Props) {
  const { width, height } = useWindowDimensions();
  const [firstRendered, setFirstRendered] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const callbacks = useRef({ onDone, onReady }); callbacks.current = { onDone, onReady };
  const readySent = useRef(false);
  const doneSent = useRef(false);
  const player = useVideoPlayer(video, item => {
    item.loop = false;
    item.muted = true;
    item.audioMixingMode = "mixWithOthers";
    item.showNowPlayingNotification = false;
    item.staysActiveInBackground = false;
    item.allowsExternalPlayback = false;
    item.currentTime = 0;
  });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const ready = useCallback(() => {
    if (!readySent.current) {
      readySent.current = true;
      callbacks.current.onReady?.();
    }
  }, []);
  const done = useCallback(() => {
    if (!doneSent.current) { doneSent.current = true; callbacks.current.onDone(); }
  }, []);
  const fail = useCallback(() => {
    setFailed(true);
    ready();
    done();
  }, [ready, done]);

  useEffect(() => {
    const subscription = player.addListener("playToEnd", () => { setEnded(true); done(); });
    return () => subscription.remove();
  }, [player, done]);
  useEffect(() => {
    if (status === "error") fail();
  }, [status, fail]);
  useEffect(() => {
    if (firstRendered || failed || staticPose) return;
    // Un décodeur indisponible ne doit pas empêcher l'accès à l'application.
    const timer = setTimeout(fail, 4000);
    return () => clearTimeout(timer);
  }, [firstRendered, failed, staticPose, fail]);
  useEffect(() => {
    try {
      if (animate && status === "readyToPlay" && !failed && !staticPose && !ended) player.play();
      else player.pause();
    } catch { fail(); }
    return () => {
      // Le hook peut avoir déjà libéré son objet natif pendant le démontage.
      try { player.pause(); } catch { /* objet déjà libéré */ }
    };
  }, [animate, status, failed, staticPose, ended, player, fail]);

  const portraitOffset = Platform.OS === "android" ? 0 : (241.5 - 175) * .49;
  return (
    <View style={{ width, height }} testID="spawt-window-mark" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View pointerEvents="none" style={{ position: "absolute", left: (width - frameWidth) / 2, top: (height - frameHeight) / 2 + portraitOffset, width: frameWidth, height: frameHeight }}>
        {!staticPose && !failed ? (
          <VideoView player={player} nativeControls={false} contentFit="fill" surfaceType="textureView"
            useExoShutter={false} allowsPictureInPicture={false} fullscreenOptions={{ enable: false }} playsInline
            onFirstFrameRender={() => { setFirstRendered(true); ready(); }}
            style={StyleSheet.absoluteFill} testID="spawt-opening-video" />
        ) : null}
        {staticPose || failed || ended || !firstRendered ? (
          <Image source={staticPose || ended ? finalPose : firstPose} fadeDuration={0} resizeMode="stretch"
            onLoad={ready} onError={fail} style={StyleSheet.absoluteFill} testID="spawt-opening-pose" />
        ) : null}
      </View>
    </View>
  );
}
