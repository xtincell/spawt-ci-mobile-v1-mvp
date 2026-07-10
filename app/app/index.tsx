// Splash / écran d'accueil (premier contact) — Story 2.2 (FR-040 + UX spec gr-night)
// Moment d'identité gr-night : fond LinearGradient (palette.black → bleu nuit).
//
// R23 (build 8) — l'animation d'ouverture (logo carte qui se trace → Moka)
// vit désormais dans <AppOpening /> au Root layout et joue à CHAQUE lancement.
// Cet écran ne rejoue plus sa propre séquence logo→Moka (le « truc étrange au
// premier lancement » du build 7 : double animation enchaînée) : il rend
// directement Moka « salut » + wordmark + tagline + CTA avec un court fondu.
// CTA « Rejoindre la bande » → émet onboarding_started avant nav.

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Animated, Pressable, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../src/theme/ThemeProvider";
import { gradient } from "../src/theme/tokens";
import { CatMark } from "../src/components/brand/CatMark";
import { track } from "../src/lib/analytics";
import { useOnboardingDraft } from "../src/store/onboarding-draft";

const ART_SIZE = 200;

export default function SplashScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // Court fondu d'entrée du contenu (l'ouverture animée R23 vient de se
  // terminer au-dessus — pas de deuxième séquence ici).
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(ctaTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [contentOpacity, ctaTranslate]);

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
      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        <CatMark
          pose="salut"
          size={ART_SIZE}
          style={{ marginBottom: theme.spacing.lg }}
        />

        <Text
          style={[
            styles.brand,
            {
              ...theme.typography.preset.display,
              color: theme.colors.brand.primary,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          SPAWT
        </Text>
        <Text
          style={[
            styles.tagline,
            {
              color: theme.colors.text.inverseSecondary,
              fontSize: theme.typography.size.lg,
              lineHeight: theme.typography.size.lg * theme.typography.lineHeight.normal,
            },
          ]}
        >
          {t("splash.tagline")}
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.cta,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            opacity: contentOpacity,
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
