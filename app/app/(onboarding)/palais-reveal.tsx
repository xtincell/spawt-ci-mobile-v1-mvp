// Palais Reveal — Story 2.6 (FR-002/003 + KPI activation SC-ACT-01)
// Dernier écran d'Epic 2 : moment-rituel `gr-night`. Au tap CTA :
//   1. `finalizeOnboarding` (lit auth.uid + persist spawter + user_palais)
//   2. Émet `onboarding_completed` (P-22 : APRÈS finalize success)
//   3. `router.replace("/(tabs)")`
//
// R8 (MAJ consolidée 07/2026, P0) — le graphe radar du Palais est RETIRÉ du
// parcours utilisateur (réservé à l'exploitation interne).
//
// Chantier 13 archétypes (PRD final §5.5) — la révélation passe désormais par
// la CARTE D'ARCHÉTYPE visuelle (remplace le héros Moka de R9) : archétype
// hérité du quiz « La Meute » si réclamé au passage OTP, sinon calculé depuis
// la calibration (moteur archetype-engine, parité quiz). Animation sobre
// (FadeInDown reanimated), texte du Chat selon le stade via chat-voice
// (`post_calibration`), mention « Pionnier n°X » si héritage.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Stack, useRouter } from "expo-router";
import { BackHandler, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import type { View as RNView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useTheme } from "../../src/theme/ThemeProvider";
import { gradient } from "../../src/theme/tokens";
import { ArchetypeCard } from "../../src/components/profile/ArchetypeCard";
import { ChatBubble } from "../../src/components/ChatBubble";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { useSpawterStore } from "../../src/store/spawter-store";
import { dominantAxes } from "../../src/lib/palais-engine";
import {
  computeArchetypeFromPalais,
  isArchetypeKey,
  type ArchetypeKey,
} from "../../src/lib/archetype-engine";
import { ARCHETYPES } from "../../src/data/archetypes";
import { ageRangeFromDateOfBirth } from "../../src/lib/age-range";
import { track } from "../../src/lib/analytics";
// Wrapped/share — la carte d'archétype se partage dès la révélation (carte
// 9:16 noir/or rendue hors-écran, capturée au tap — lib/share-card.ts).
import { ShareCard } from "../../src/components/share/ShareCard";
import { captureAndShareView } from "../../src/lib/share-card";

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

  // Wrapped/share — ref de la carte 9:16 hors-écran (capture au tap).
  const shareCardRef = useRef<RNView>(null);

  const ans = draft.calibration_answers;

  // Chantier 13 archétypes — même logique de priorité que finalizeOnboarding
  // (héritage quiz > calcul calibration) pour que la carte révélée soit
  // EXACTEMENT celle qui sera persistée au tap CTA.
  const heritage = draft.meute_heritage;
  const inheritedArchetype: ArchetypeKey | null =
    heritage?.claimed && isArchetypeKey(heritage.archetype) ? heritage.archetype : null;
  const archetypeKey: ArchetypeKey = useMemo(
    () =>
      inheritedArchetype ??
      computeArchetypeFromPalais({
        axe_racines_horizons: ans.racines_horizons ?? 0,
        axe_taniere_nomade: ans.taniere_nomade ?? 0,
        axe_exigeant_enthousiaste: ans.exigeant_enthousiaste ?? 0,
        axe_foule_secret: ans.foule_secret ?? 0,
        axe_maquis_table: ans.maquis_table ?? 0,
      }).key,
    [inheritedArchetype, ans],
  );
  const pionnierSeq =
    inheritedArchetype && typeof heritage?.pionnier_seq === "number"
      ? heritage.pionnier_seq
      : null;

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

      // Story 4.8 — `age_range` est dérivé du `date_of_birth` du draft (helper
      // pur). On émet la tranche calculée, pas la date brute (invariant PII).
      const derivedAgeRange = draft.date_of_birth
        ? ageRangeFromDateOfBirth(draft.date_of_birth)
        : null;
      track({
        name: "onboarding_completed",
        properties: {
          country_code: draft.country_code,
          age_range: derivedAgeRange,
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
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
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

        {/* R8 + chantier 13 archétypes — la révélation passe par la carte
            visuelle (radar interne). Animation sobre, pas de confettis. */}
        <Animated.View
          entering={FadeInDown.duration(600)}
          style={{ marginTop: theme.spacing.lg }}
        >
          <ArchetypeCard archetypeKey={archetypeKey} pionnierSeq={pionnierSeq} />
        </Animated.View>

        {/* Héritage quiz « La Meute » — mention du pionnier, ton complice. */}
        {pionnierSeq ? (
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.inverseSecondary,
              textAlign: "center",
              marginTop: theme.spacing.base,
            }}
          >
            {t("palais_reveal.heritage_mention", {
              n: pionnierSeq,
              archetype: t(ARCHETYPES[archetypeKey].nameKey),
            })}
          </Text>
        ) : null}

        {/* Voix du Chat selon le stade (chat-voice `post_calibration`) —
            l'onboarding est toujours au stade touriste. */}
        <View style={{ marginTop: theme.spacing.lg }}>
          <ChatBubble stade="touriste" moment="post_calibration" />
        </View>

        {/* Wrapped/share — partage de la carte d'archétype (lien sobre,
            jamais bloquant : échec silencieux, l'onboarding continue). */}
        <Pressable
          onPress={() => {
            track({
              name: "share_initiated",
              properties: { surface: "palais_reveal", archetype: archetypeKey },
            });
            void captureAndShareView(
              shareCardRef.current,
              t("palais_reveal.share_dialog_title"),
            ).then((shared) => {
              if (shared) {
                track({
                  name: "share_completed",
                  properties: { surface: "palais_reveal", archetype: archetypeKey },
                });
              }
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={t("palais_reveal.share_cta")}
          testID="palais-reveal-share"
          style={({ pressed }) => ({
            alignSelf: "center",
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.base,
            marginTop: theme.spacing.base,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.brand.primary,
              textDecorationLine: "underline",
            }}
          >
            {t("palais_reveal.share_cta")}
          </Text>
        </Pressable>

        {/* Carte 9:16 rendue hors-écran, capturée par le bouton ci-dessus. */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: -9999, top: 0 }}
        >
          <ShareCard
            ref={shareCardRef}
            kicker={t("palais_reveal.share_card_kicker")}
            headline={t(ARCHETYPES[archetypeKey].nameKey)}
            subline={draft.display_name}
            archetype={archetypeKey}
            footer={
              pionnierSeq
                ? t("palais_reveal.share_card_pionnier", { n: pionnierSeq })
                : undefined
            }
          />
        </View>

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
      </ScrollView>

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
  // Chantier 13 archétypes — la carte peut dépasser un petit écran : scroll.
  content: { flex: 1 },
  cta: {},
});
