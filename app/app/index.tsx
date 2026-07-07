// Splash / écran d'accueil (premier contact) — Story 2.2 (FR-040 + UX spec gr-night)
// Moment d'identité gr-night : fond LinearGradient (palette.black → bleu nuit).
// R15 (MAJ consolidée 07/2026) — démarrage ANIMÉ : le logo PRIMAIRE VECTORISÉ
// (AnimatedLogoMark — le pin carte se trace, la route en S se dessine, le
// soleil d'or éclot, les étoiles scintillent) puis crossfade vers le splash
// art (pose Moka « salut » en PNG — la mascotte reste PNG, règle DS), tagline
// et CTA. CTA « Rejoindre la bande » → émet onboarding_started avant nav.

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Animated, Pressable, Text, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../src/theme/ThemeProvider";
import { gradient } from "../src/theme/tokens";
import { CatMark } from "../src/components/brand/CatMark";
import { AnimatedLogoMark } from "../src/components/brand/AnimatedLogoMark";
import { track } from "../src/lib/analytics";
import { useOnboardingDraft } from "../src/store/onboarding-draft";

const ART_SIZE = 200;
// Durée de la séquence interne d'AnimatedLogoMark (~1,6 s) + un temps de
// lecture avant le passage au splash art.
const LOGO_SEQUENCE_MS = 1900;

export default function SplashScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // R15 — séquence : logo vectorisé qui se dessine → splash art (Moka salut).
  const pinOpacity = useRef(new Animated.Value(1)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const mokaOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const sequence = Animated.sequence([
      // 1. Le wordmark s'installe pendant que le logo se trace (composant).
      Animated.timing(brandOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.delay(Math.max(0, LOGO_SEQUENCE_MS - 700)),
      // 2. Le splash art prend le relais (crossfade logo → pose salut),
      //    tagline + CTA arrivent.
      Animated.parallel([
        Animated.timing(pinOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(mokaOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(taglineOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(ctaOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(ctaTranslate, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [pinOpacity, brandOpacity, mokaOpacity, taglineOpacity, ctaOpacity, ctaTranslate]);

  const onStart = () => {
    // P18 — idempotent : ne pas écraser un started_at déjà posé si l'utilisateur
    // re-tape le CTA (ex: back depuis consent puis re-Splash).
    const draftState = useOnboardingDraft.getState();
    if (draftState.draft.started_at === null) {
      draftState.setField("started_at", Date.now());
    }
    track({ name: "onboarding_started", properties: {} });
    router.push("/(onboarding)/consent");
  };

  return (
    <LinearGradient colors={gradient.night} style={styles.root}>
      <View style={styles.content}>
        {/* Pile de crossfade logo → splash art (même emprise, pas de saut). */}
        <View style={{ width: ART_SIZE, height: ART_SIZE, marginBottom: theme.spacing.lg }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: pinOpacity }]}>
            <AnimatedLogoMark size={ART_SIZE} delayMs={150} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: mokaOpacity }]}>
            <CatMark pose="salut" size={ART_SIZE} />
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.brand,
            {
              ...theme.typography.preset.display,
              color: theme.colors.brand.primary,
              marginBottom: theme.spacing.md,
              opacity: brandOpacity,
            },
          ]}
        >
          SPAWT
        </Animated.Text>
        <Animated.Text
          style={[
            styles.tagline,
            {
              color: theme.colors.text.inverseSecondary,
              fontSize: theme.typography.size.lg,
              lineHeight: theme.typography.size.lg * theme.typography.lineHeight.normal,
              opacity: taglineOpacity,
            },
          ]}
        >
          {t("splash.tagline")}
        </Animated.Text>
      </View>

      <Animated.View
        style={[
          styles.cta,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            opacity: ctaOpacity,
            transform: [{ translateY: ctaTranslate }],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onStart}
          testID="splash-start"
          style={({ pressed }) => [
            {
              backgroundColor: theme.colors.brand.primary,
              paddingVertical: theme.spacing.base,
              borderRadius: theme.radius.lg,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={{
              color: theme.colors.text.onBrand,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              textAlign: "center",
            }}
          >
            {t("splash.cta_start")}
          </Text>
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  brand: { letterSpacing: 4 },
  tagline: { textAlign: "center", maxWidth: 320 },
  cta: {},
});
