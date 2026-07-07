// Calibrage Palais — Story 2.5 (FR-002 + FR-025 + UX D10 OnbMidfi)
// 5 questions visuelles multi-select. Au tap Suivant : direction résolue via
// le moteur pur `calibration-mapping`, delta écrit dans `useOnboardingDraft`,
// event analytics `calibration_answered` émis. La 5e question pushe vers
// `palais-reveal` (Story 2.6) — la création row spawters reste Story 2.6.
//
// Retour alpha R16 — la 1re question (axe `racines_horizons`, type de cuisine)
// se rend en `Select` multi au lieu de la grille de cartes ; mêmes options,
// mêmes indexes → `resolveDirection` et les events analytics sont inchangés.
// Les 4 autres questions gardent leurs cartes. (Visuels de cuisine à venir.)

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import {
  CALIBRATION_QUESTIONS,
  resolveDirection,
} from "../../src/lib/calibration-mapping";
import { ChatBubble } from "../../src/components/ChatBubble";
import { OnbCard } from "../../src/components/primitives/OnbCard";
import { Select } from "../../src/components/primitives/Select";
import { track } from "../../src/lib/analytics";

const TOTAL = CALIBRATION_QUESTIONS.length;

// R16 — seul cet axe se rend en Select multi (type de cuisine).
const SELECT_AXIS = "racines_horizons";

export default function CalibrationScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const setCalibration = useOnboardingDraft((s) => s.setCalibration);

  const [step, setStep] = useState(0);
  const [selectedByStep, setSelectedByStep] = useState<readonly (readonly number[])[]>(() =>
    Array.from({ length: TOTAL }, () => [] as readonly number[]),
  );

  const question = CALIBRATION_QUESTIONS[step];
  if (!question) return null;

  const selected = selectedByStep[step] ?? [];
  // D4 — `Continuer` n'est actif que si ≥1 carte sélectionnée. Pour passer
  // sans avis, le spawter tape le bouton dédié `Pas d'avis` (neutral).
  const canContinue = selected.length > 0;

  const toggleCard = (idx: number) => {
    setSelectedByStep((prev) => {
      const next = prev.map((s, i) => (i === step ? toggleIndex(s, idx) : s));
      return next;
    });
  };

  const advance = (
    direction: "neg" | "pos" | "neutral",
    value: -0.4 | 0 | 0.4 | null,
    skipped: boolean = false,
  ) => {
    track({
      name: "calibration_answered",
      // P-25 — flag `skipped` pour distinguer skip explicite vs neutral cards.
      // P-33 — sentinel `null` pour skip ; `0` reste valide pour neutral résolu.
      properties: { axis: question.axis, direction, value, skipped },
    });
    setCalibration(question.axis, value);

    if (step + 1 < TOTAL) {
      setStep(step + 1);
    } else {
      track({
        name: "onboarding_step_completed",
        properties: { step: "calibration", step_index: 4 },
      });
      router.push("/(onboarding)/palais-reveal");
    }
  };

  const onNext = () => {
    const direction = resolveDirection(selected, question.cards);
    const value: -0.4 | 0 | 0.4 =
      direction === "neg" ? -0.4 : direction === "pos" ? 0.4 : 0;
    advance(direction, value);
  };

  // P-33 — `onSkip` écrit `null` (et non `0`) pour signaler un skip explicite.
  // L'écran palais-reveal et le store filtrent `v !== null && v !== 0` pour
  // compter les vrais signaux (cf. P-33 + palais-reveal.tsx + spawter-store.ts).
  const onSkip = () => advance("neutral", null, true);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["2xl"] }}
      keyboardShouldPersistTaps="handled"
    >
      <ProgressSegments current={step} total={TOTAL} />

      <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.base }}>
        <ChatBubble stade="touriste" moment="welcome_first_open" />
      </View>

      <Text
        style={{
          ...theme.typography.preset.h2,
          color: theme.colors.text.primary,
          marginTop: theme.spacing.base,
        }}
      >
        {t(`calibration.q_${question.axis}.question` as const)}
      </Text>

      {question.axis === SELECT_AXIS ? (
        // R16 — Select multi : `values` = altKeys des cartes sélectionnées,
        // toggle re-mappé vers l'index de carte pour que `selected` (indexes)
        // et donc `resolveDirection` restent inchangés.
        <View style={{ marginTop: theme.spacing.lg }}>
          <Select
            multi
            placeholder={t("calibration.q_racines_horizons.select_placeholder")}
            values={selected
              .map((idx) => question.cards[idx]?.altKey)
              .filter((k): k is string => k !== undefined)}
            options={question.cards.map((card) => ({
              key: card.altKey,
              label: t(card.labelKey),
            }))}
            onToggle={(key) => {
              const idx = question.cards.findIndex((card) => card.altKey === key);
              if (idx >= 0) toggleCard(idx);
            }}
            doneLabel={t("calibration.q_racines_horizons.select_done")}
            testID={`calibration-select-${question.axis}`}
            accessibilityLabel={t("calibration.q_racines_horizons.question")}
          />
        </View>
      ) : (
        <View
          testID="calibration-grid"
          style={{
            marginTop: theme.spacing.lg,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.spacing.sm,
          }}
        >
          {question.cards.map((card, idx) => (
            <View key={card.altKey} style={{ width: "47%" }}>
              <OnbCard
                label={t(card.labelKey)}
                selected={selected.includes(idx)}
                onToggle={() => toggleCard(idx)}
                testID={`calibration-card-${question.axis}-${card.altKey}`}
              />
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={onNext}
        disabled={!canContinue}
        testID="calibration-next"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canContinue }}
        style={({ pressed }) => ({
          marginTop: theme.spacing.xl,
          backgroundColor: canContinue
            ? theme.colors.brand.accent
            : theme.colors.border.subtle,
          paddingVertical: theme.spacing.base,
          borderRadius: theme.radius.lg,
          opacity: canContinue && pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: canContinue ? theme.colors.text.inverse : theme.colors.text.tertiary,
            fontSize: theme.typography.size.lg,
            fontWeight: theme.typography.weight.semibold,
            textAlign: "center",
          }}
        >
          {step + 1 < TOTAL ? t("common.continue") : t("calibration.cta_finish")}
        </Text>
      </Pressable>

      <Pressable
        onPress={onSkip}
        testID="calibration-skip"
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.tertiary,
            textAlign: "center",
            textDecorationLine: "underline",
          }}
        >
          {t("calibration.cta_skip")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function toggleIndex(arr: readonly number[], idx: number): readonly number[] {
  return arr.includes(idx) ? arr.filter((i) => i !== idx) : [...arr, idx];
}

function ProgressSegments({ current, total }: { current: number; total: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: theme.spacing.xs,
        marginTop: theme.spacing.lg,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const state: "past" | "current" | "future" =
          i < current ? "past" : i === current ? "current" : "future";
        const bg =
          state === "current"
            ? theme.colors.brand.primary
            : state === "past"
              ? theme.colors.brand.primary
              : theme.colors.border.subtle;
        const opacity = state === "past" ? 0.5 : 1;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: bg,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}
