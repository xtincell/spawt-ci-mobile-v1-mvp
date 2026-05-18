// Palais Reveal — Story 2.6 (FR-002/003 + KPI activation SC-ACT-01)
// Dernier écran d'Epic 2 : présente le Palais initial + premier titre dans un
// moment-rituel `gr-night`. Au tap CTA :
//   1. `finalizeOnboarding` (lit auth.uid + persist spawter + user_palais)
//   2. Émet `onboarding_completed` (P-22 : APRÈS finalize success)
//   3. `router.replace("/(tabs)")`

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Stack, useRouter } from "expo-router";
import { BackHandler, Pressable, Text, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../../src/theme/ThemeProvider";
import { gradient } from "../../src/theme/tokens";
import { ChatBubble } from "../../src/components/ChatBubble";
import { PalaisRadar } from "../../src/components/primitives/PalaisRadar";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { useSpawterStore } from "../../src/store/spawter-store";
import { computeConfidence, dominantAxes } from "../../src/lib/palais-engine";
import { track } from "../../src/lib/analytics";

// Calibration delta range is [-0.4, +0.4] (cf. calibration-mapping.ts).
// Map to radar value [0, 1] : (v + 0.4) / 0.8.
// P-27 — clamp pour valeurs corrompues (NaN, hors plage) + P-33 null → 0.5
// (neutre sur le radar quand le spawter a explicitement skip).
function toRadar(v: number | null): number {
  if (v === null || !Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, (v + 0.4) / 0.8));
}

export default function PalaisRevealScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const draft = useOnboardingDraft((s) => s.draft);
  const finalizeOnboarding = useSpawterStore((s) => s.finalizeOnboarding);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P-19 round 3 — guard mountedRef pour éviter setState après unmount (nav
  // `router.replace` peut unmount avant que les setState du catch/finally
  // n'aient run).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const ans = draft.calibration_answers;
  // DN-5 round 3 — filter strict `v !== null` : seul le skip explicite
  // (sentinel `null`, P-33) est exclu du count. Le `value=0` (« neutral
  // résolu » : user a coché à la fois des cartes posa et néga → signal
  // délibéré et équilibré) compte comme une vraie réponse. Le confidence
  // mesure le nombre de questions auxquelles le user a engagé une réponse,
  // peu importe la direction. La force directionnelle est calculée séparément
  // via `dominantAxes(ax)` qui pondère par l'amplitude.
  const answeredCount = useMemo(
    () => Object.values(ans).filter((v): v is number => v !== null).length,
    [ans],
  );
  const confidence = useMemo(() => computeConfidence(answeredCount), [answeredCount]);
  const underConstruction = confidence < 0.3;

  // P-23 — `submittingRef` mis à jour dans un effet pour éviter la stale
  // closure capturée par le BackHandler listener. Sans ça, un back-press
  // pendant la fenêtre de commit React entre `setSubmitting(true)` et le
  // re-render lit l'ancienne valeur.
  const submittingRef = useRef(false);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);
  useEffect(() => {
    // Android — bloque le bouton retour pendant finalizeOnboarding pour éviter
    // un exit mid-write qui laisserait un spawter partiellement persisté.
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      () => submittingRef.current,
    );
    return () => sub.remove();
  }, []);

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
        axe_racines_horizons: ans.racines_horizons ?? 0,
        axe_taniere_nomade: ans.taniere_nomade ?? 0,
        axe_exigeant_enthousiaste: ans.exigeant_enthousiaste ?? 0,
        axe_foule_secret: ans.foule_secret ?? 0,
        axe_maquis_table: ans.maquis_table ?? 0,
      });

      // P17 — sentinelle -1 si started_at jamais initialisé (cas edge resume)
      // pour ne pas polluer le KPI funnel avec un faux zéro.
      const seconds = draft.started_at
        ? Math.max(0, Math.round((Date.now() - draft.started_at) / 1000))
        : -1;
      if (seconds === -1 && __DEV__) {
        console.warn("[palais-reveal] started_at null at finalize — KPI sentinel -1");
      }

      // P-22 — emit `onboarding_completed` AVANT le throw potentiel de finalize
      // gonflerait artificiellement le funnel KPI Kidam vs taux de finalize
      // réel. Désormais : finalize d'abord, track ensuite SI succès.
      await finalizeOnboarding(draft);

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

      router.replace("/(tabs)");
    } catch (_err) {
      // P-19 round 3 — guard mountedRef.
      if (mountedRef.current) {
        setError(t("common.error_generic"));
        setSubmitting(false);
      }
    } finally {
      // P-20 round 3 — `finally` pour relâcher submitting même sur succès si
      // le composant n'a pas encore unmount (cas re-render entre await et nav).
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={gradient.night} style={styles.root}>
      {/* P-24 — désactive le swipe-back iOS au niveau route (BackHandler
          couvre Android). Conjointement, finalize ne peut être bypassé. */}
      <Stack.Screen options={{ gestureEnabled: !submitting }} />
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
