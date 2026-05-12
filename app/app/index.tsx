// Splash / écran d'accueil (premier contact)
// La voix du Chat parle dès l'ouverture (PRD §9.3 Touriste)

import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useTheme } from "../src/theme/ThemeProvider";

export default function SplashScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.surface.inverse }]}>
      <View style={styles.content}>
        <Text
          style={[
            styles.brand,
            {
              color: theme.colors.brand.primary,
              fontSize: theme.typography.size["3xl"],
              fontWeight: theme.typography.weight.bold,
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

      <View style={[styles.cta, { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(onboarding)/consent")}
          style={({ pressed }) => [
            {
              backgroundColor: theme.colors.brand.accent,
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  brand: { letterSpacing: 4 },
  tagline: { textAlign: "center", maxWidth: 320 },
  cta: {},
});
