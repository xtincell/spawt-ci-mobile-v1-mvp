// Ouverture V2 fournie : carte fixe → chat au repère → clin d’œil → route prête.
// La restauration du compte se fait derrière l'overlay. Les rerenders du
// Root ne rejouent aucune séquence ; un tap passe directement à la sortie.

import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { palette } from "../../theme/tokens";
import { WindowOpeningMark } from "./WindowOpeningMark";
import { WINDOW_EXIT_MS } from "./window-opening-motion";

const USE_NATIVE_DRIVER = Platform.OS !== "web";
const SKIP_FADE_MS = 160;

interface Props {
  onFinished: () => void;
  onArtworkReady?: () => void;
  /** Le splash natif est retiré et la première surface React est dessinée. */
  start?: boolean;
  /** La session est restaurée et la navigation a rejoint sa route initiale. */
  ready?: boolean;
  testID?: string;
}

export function AppOpening({ onFinished, onArtworkReady, start = true, ready = true, testID }: Props) {
  const { t } = useTranslation();
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const artworkOpacity = useRef(new Animated.Value(1)).current;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const completedRef = useRef(false);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  // Attendre la préférence évite de lancer un mouvement avant sa lecture.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const onMotionDone = useCallback(() => setSequenceDone(true), []);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true;
      if (active) setReduceMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => { if (active && !changed) setReduceMotion(value); },
      () => { if (active && !changed) setReduceMotion(false); },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || skipped) setSequenceDone(true);
  }, [reduceMotion, skipped]);

  useEffect(() => {
    if (!start || !sequenceDone || !ready) return;
    const duration = reduceMotion ? 0 : skipped ? SKIP_FADE_MS : WINDOW_EXIT_MS;
    // L'accueil contient aussi Moka, à une autre échelle et position. Retirer
    // d'abord l'illustration évite deux mascottes superposées pendant le fondu.
    const fade = Animated.sequence([
      Animated.timing(artworkOpacity, {
        toValue: 0, duration: duration / 2, useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0, duration: duration / 2, useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    fade.start(({ finished }) => {
      // stop() appelle aussi le callback, avec finished=false.
      if (finished && !completedRef.current) {
        completedRef.current = true;
        onFinishedRef.current();
      }
    });
    return () => fade.stop();
  }, [start, sequenceDone, ready, reduceMotion, skipped, overlayOpacity, artworkOpacity]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity, zIndex: 999 }]}
      // Conserver la surface tactile jusqu'au démontage : un double-tap de
      // passage ne doit pas déclencher le CTA situé derrière l'overlay.
      accessibilityViewIsModal
      testID={testID ?? "app-opening"}
    >
      <Pressable
        style={{ flex: 1 }}
        onPress={() => setSkipped(true)}
        accessibilityRole="button"
        accessibilityLabel={t("common.skip")}
        testID="app-opening-skip"
      >
        <View style={styles.root}>
          <Animated.View style={[styles.artwork, { opacity: artworkOpacity }]}>
            <WindowOpeningMark
              animate={start && reduceMotion === false && !skipped}
              staticPose={reduceMotion === true || skipped}
              onDone={onMotionDone}
              onReady={onArtworkReady}
            />
          </Animated.View>
          {sequenceDone && !ready ? (
            <ActivityIndicator style={{ position: "absolute", bottom: 64 }} color={palette.gold} accessibilityLabel={t("common.loading")} />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.pureWhite, alignItems: "center", justifyContent: "center" },
  artwork: { flex: 1 },
});
