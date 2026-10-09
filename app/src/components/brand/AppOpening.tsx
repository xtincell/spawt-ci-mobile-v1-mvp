// Ouverture : tracé du logo → Moka → fondu vers la route prête.
// La restauration du compte se fait derrière l'overlay. Les rerenders du
// Root ne rejouent aucune séquence ; un tap passe directement à la sortie.

import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";

import { gradient, palette, typography } from "../../theme/tokens";
import { AnimatedLogoMark } from "./AnimatedLogoMark";
import { CatMark } from "./CatMark";

const ART_SIZE = 180;
const USE_NATIVE_DRIVER = Platform.OS !== "web";
const MOKA_HOLD_MS = 380;
const CROSSFADE_MS = 380;
const FADE_OUT_MS = 320;
const SKIP_FADE_MS = 160;

interface Props {
  onFinished: () => void;
  /** La session est restaurée et la navigation a rejoint sa route initiale. */
  ready?: boolean;
  testID?: string;
}

export function AppOpening({ onFinished, ready = true, testID }: Props) {
  const { t } = useTranslation();
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const artworkOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const mokaOpacity = useRef(new Animated.Value(0)).current;
  const mokaScale = useRef(new Animated.Value(0.92)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const completedRef = useRef(false);
  const [logoDone, setLogoDone] = useState(false);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  // Attendre la préférence évite de lancer un mouvement avant sa lecture.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const onLogoDone = useCallback(() => setLogoDone(true), []);

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
    if (reduceMotion === null && !skipped) return;
    if (reduceMotion || skipped) {
      brandOpacity.setValue(1);
      logoOpacity.setValue(0);
      mokaOpacity.setValue(1);
      mokaScale.setValue(1);
      setSequenceDone(true);
      return;
    }
    const anim = Animated.timing(brandOpacity, {
      toValue: 1, duration: 650, useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, skipped, brandOpacity, logoOpacity, mokaOpacity, mokaScale]);

  useEffect(() => {
    if (!logoDone || skipped || reduceMotion !== false) return;
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 0, duration: CROSSFADE_MS, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(mokaOpacity, { toValue: 1, duration: CROSSFADE_MS, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(mokaScale, { toValue: 1, duration: CROSSFADE_MS, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
      Animated.delay(MOKA_HOLD_MS),
    ]);
    sequence.start(({ finished }) => {
      if (finished) setSequenceDone(true);
    });
    return () => sequence.stop();
  }, [logoDone, skipped, reduceMotion, logoOpacity, mokaOpacity, mokaScale]);

  useEffect(() => {
    if (!sequenceDone || !ready) return;
    const duration = reduceMotion ? 0 : skipped ? SKIP_FADE_MS : FADE_OUT_MS;
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
  }, [sequenceDone, ready, reduceMotion, skipped, overlayOpacity, artworkOpacity]);

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
        <LinearGradient colors={gradient.night} style={styles.root}>
          <Animated.View style={[styles.artwork, { opacity: artworkOpacity }]}>
            <View style={{ width: ART_SIZE, height: ART_SIZE }}>
              <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: logoOpacity }]}>
                {reduceMotion === false && !skipped ? (
                  <AnimatedLogoMark size={ART_SIZE} delayMs={120} onDone={onLogoDone} />
                ) : null}
              </Animated.View>
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  { opacity: mokaOpacity, transform: [{ scale: mokaScale }] },
                ]}
              >
                <CatMark pose="salut" size={ART_SIZE} />
              </Animated.View>
            </View>
            <Animated.Text style={[styles.brand, { opacity: brandOpacity }]}>
              SPAWT
            </Animated.Text>
          </Animated.View>
          {sequenceDone && !ready ? (
            <ActivityIndicator style={{ position: "absolute", bottom: 64 }} color={palette.gold} accessibilityLabel={t("common.loading")} />
          ) : null}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  artwork: { alignItems: "center", gap: 24 },
  brand: { ...typography.preset.display, color: palette.gold, letterSpacing: 4 },
});
