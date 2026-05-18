// Splash / écran d'accueil (premier contact) — Story 2.2 (FR-040 + UX spec gr-night)
// Moment d'identité gr-night : fond LinearGradient (palette.black → bleu nuit).
// CTA « Entrer dans la Meute » → émet onboarding_started avant nav.

import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../src/theme/ThemeProvider";
import { gradient } from "../src/theme/tokens";
import { track } from "../src/lib/analytics";
import { useOnboardingDraft } from "../src/store/onboarding-draft";

export default function SplashScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

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
      </View>

      <View
        style={[
          styles.cta,
          { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
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
      </View>
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
