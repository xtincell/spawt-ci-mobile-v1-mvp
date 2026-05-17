// Calibrage Palais — Story 2.5 (FR-002 + FR-025 + UX D10 OnbMidfi)
// 5 questions visuelles multi-select. Au tap Suivant : direction résolue via
// le moteur pur `calibration-mapping`, delta écrit dans `useOnboardingDraft`,
// event analytics `calibration_answered` émis. La 5e question pushe vers
// `palais-reveal` (Story 2.6) — la création row spawters reste Story 2.6.

import { useMemo, useState } from "react";
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
import { track } from "../../src/lib/analytics";

const TOTAL = CALIBRATION_QUESTIONS.length;

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
  const canContinue = true; // multi-select autorise 0 → direction = "neutral"

  const toggleCard = (idx: number) => {
    setSelectedByStep((prev) => {
      const next = prev.map((s, i) => (i === step ? toggleIndex(s, idx) : s));
      return next;
    });
  };

  const onNext = () => {
    const direction = resolveDirection(selected, question.cards);
    const value: -0.4 | 0 | 0.4 =
      direction === "neg" ? -0.4 : direction === "pos" ? 0.4 : 0;

    track({
      name: "calibration_answered",
      properties: {
        axis: question.axis,
        direction,
        value,
      },
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
              altKey={card.altKey}
              selected={selected.includes(idx)}
              onToggle={() => toggleCard(idx)}
              testID={`calibration-card-${question.axis}-${card.altKey}`}
            />
          </View>
        ))}
      </View>

      <Pressable
        onPress={onNext}
        disabled={!canContinue}
        testID="calibration-next"
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: theme.spacing.xl,
          backgroundColor: theme.colors.brand.accent,
          paddingVertical: theme.spacing.base,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: theme.colors.text.inverse,
            fontSize: theme.typography.size.lg,
            fontWeight: theme.typography.weight.semibold,
            textAlign: "center",
          }}
        >
          {step + 1 < TOTAL ? t("common.continue") : t("calibration.cta_finish")}
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
