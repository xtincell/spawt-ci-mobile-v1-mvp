// AppOpening — R23 (build 8) : ouverture animée à CHAQUE lancement de l'app
// (référence produit : TheFork, Duolingo, Yango). Overlay plein écran rendu
// par le Root layout au-dessus de la navigation :
//
//   logo carte vectorisé qui se trace (AnimatedLogoMark, ~1,6 s)
//     → crossfade vers la mascotte Moka (pose « salut », PNG — règle DS)
//     → fondu de sortie de l'overlay.
//
// Jamais bloquante : ~2 s au total, un TAP n'importe où skippe immédiatement
// (fondu accéléré). Pur Animated natif — aucune dépendance nouvelle.
// L'app se charge DERRIÈRE l'overlay (hydratation, fonts déjà prêtes).

import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { gradient, palette } from "../../theme/tokens";
import { AnimatedLogoMark } from "./AnimatedLogoMark";
import { CatMark } from "./CatMark";

const ART_SIZE = 180;
/** Pause de lecture sur Moka avant le fondu de sortie (ms). */
const MOKA_HOLD_MS = 380;
const CROSSFADE_MS = 380;
const FADE_OUT_MS = 320;
const SKIP_FADE_MS = 160;

interface Props {
  /** Appelé quand l'overlay a fini de disparaître (séquence complète ou skip). */
  onFinished: () => void;
  testID?: string;
}

export function AppOpening({ onFinished, testID }: Props) {
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const mokaOpacity = useRef(new Animated.Value(0)).current;
  const mokaScale = useRef(new Animated.Value(0.92)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  // `finishing` : garde anti double-fin (tap pendant le fondo de sortie).
  const finishingRef = useRef(false);
  const [logoDone, setLogoDone] = useState(false);

  const finish = useCallback(
    (durationMs: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: durationMs,
        useNativeDriver: true,
      }).start(() => {
        onFinished();
      });
    },
    [overlayOpacity, onFinished],
  );

  // Le wordmark s'installe pendant le tracé du logo.
  useEffect(() => {
    const anim = Animated.timing(brandOpacity, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [brandOpacity]);

  // Fin du tracé du logo → crossfade Moka → pause → fondu de sortie.
  useEffect(() => {
    if (!logoDone) return;
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(mokaOpacity, {
          toValue: 1,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(mokaScale, {
          toValue: 1,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(MOKA_HOLD_MS),
    ]);
    sequence.start(({ finished }) => {
      if (finished) finish(FADE_OUT_MS);
    });
    return () => sequence.stop();
  }, [logoDone, logoOpacity, mokaOpacity, mokaScale, finish]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity, zIndex: 999 }]}
      pointerEvents={finishingRef.current ? "none" : "auto"}
      testID={testID ?? "app-opening"}
    >
      {/* Skippable au tap — n'importe où sur l'overlay. */}
      <Pressable
        style={{ flex: 1 }}
        onPress={() => finish(SKIP_FADE_MS)}
        accessibilityRole="button"
        accessibilityLabel="SPAWT"
        testID="app-opening-skip"
      >
        <LinearGradient colors={gradient.night} style={styles.root}>
          <View style={{ width: ART_SIZE, height: ART_SIZE }}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: logoOpacity }]}>
              <AnimatedLogoMark
                size={ART_SIZE}
                delayMs={120}
                onDone={() => setLogoDone(true)}
              />
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
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  brand: {
    color: palette.gold,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 4,
  },
});
