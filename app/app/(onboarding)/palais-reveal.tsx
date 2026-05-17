// Palais Reveal — Story 2.6 (FR-002/003 + KPI activation SC-ACT-01)
// Dernier écran d'Epic 2 : présente le Palais initial + premier titre dans un
// moment-rituel `gr-night`. Au tap CTA :
//   1. Émet `onboarding_completed` (avec time_to_complete_seconds + dominant_axes)
//   2. `finalizeOnboarding` (lit auth.uid + persist spawter + user_palais)
//   3. `router.replace("/(tabs)")`

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../../src/theme/ThemeProvider";
import { gradient } from "../../src/theme/tokens";
import { ChatBubble } from "../../src/components/ChatBubble";
import { PalaisRadar } from "../../src/components/primitives/PalaisRadar";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { useSpawterStore } from "../../src/store/spawter-store";
import { computeConfidence, dominantAxes } from "../../src/lib/palais-engine";
import { track } from "../../src/lib/analytics";

// Map calibration value [-0.4, +0.4] → radar value [0, 1] via (v+1)/2.
function toRadar(v: number): number {
  return (v + 1) / 2;
}

export default function PalaisRevealScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const draft = useOnboardingDraft((s) => s.draft);
  const finalizeOnboarding = useSpawterStore((s) => s.finalizeOnboarding);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ans = draft.calibration_answers;
  const confidence = useMemo(() => computeConfidence(0), []);
  const underConstruction = confidence < 0.3;

  const radarValues: readonly [number, number, number, number, number] = [
    toRadar(ans.taniere_nomade),
    toRadar(ans.foule_secret),
    toRadar(ans.maquis_table),
    toRadar(ans.exigeant_enthousiaste),
    toRadar(ans.racines_horizons),
  ];

  const onContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const dominant = dominantAxes({
        axe_racines_horizons: ans.racines_horizons,
        axe_taniere_nomade: ans.taniere_nomade,
        axe_exigeant_enthousiaste: ans.exigeant_enthousiaste,
        axe_foule_secret: ans.foule_secret,
        axe_maquis_table: ans.maquis_table,
      });

      const seconds = draft.started_at
        ? Math.max(0, Math.round((Date.now() - draft.started_at) / 1000))
        : 0;

      track({
        name: "onboarding_completed",
        properties: {
          country_code: draft.country_code,
          age_range: draft.age_range,
          gender: draft.gender,
          time_to_complete_seconds: seconds,
          palais_initial_dominant_axes: dominant ?? [],
        },
      });

      await finalizeOnboarding(draft);
      router.replace("/(tabs)");
    } catch (_err) {
      setError(t("common.error_generic"));
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={gradient.night} style={styles.root}>
      <View style={[styles.content, { padding: theme.spacing.lg }]}>
        <View style={{ marginBottom: theme.spacing.lg }}>
          <ChatBubble stade="touriste" moment="post_calibration" variant="edito" />
        </View>

        <View style={{ alignItems: "center", marginVertical: theme.spacing.xl }}>
          <PalaisRadar
            values={radarValues}
            underConstruction={underConstruction}
            underConstructionLabel={t("palais.underConstruction")}
            size={240}
          />
        </View>

        <Text
          style={{
            ...theme.typography.preset.h1,
            color: theme.colors.brand.primary,
            textAlign: "center",
          }}
        >
          {t("palais_reveal.first_title")}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.inverseSecondary,
            textAlign: "center",
            marginTop: theme.spacing.xs,
          }}
        >
          {t("palais_reveal.first_title_subtitle")}
        </Text>

        {error ? (
          <Text
            style={{
              marginTop: theme.spacing.lg,
              textAlign: "center",
              color: theme.colors.state.danger,
              fontSize: theme.typography.size.sm,
            }}
          >
            {error}
          </Text>
        ) : null}
      </View>

      <View style={[styles.cta, { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={() => void onContinue()}
          testID="palais-reveal-continue"
          style={({ pressed }) => ({
            backgroundColor: theme.colors.brand.primary,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.lg,
            opacity: pressed && !submitting ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.text.onBrand,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              textAlign: "center",
            }}
          >
            {t("palais_reveal.continue")}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between" },
  content: { flex: 1, justifyContent: "center" },
  cta: {},
});
