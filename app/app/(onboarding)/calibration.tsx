// Étape 3 onboarding — 5 questions de calibrage du Palais (PRD §20.2)
// Une question par axe. Réponse → delta {-0.4, 0, +0.4} sur l'axe correspondant.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import {
  useOnboardingDraft,
} from "../../src/store/onboarding-draft";
import { useSpawterStore, calibrationDelta } from "../../src/store/spawter-store";
import type { PalaisAxis } from "../../src/types/palais";

interface QuestionDef {
  axis: PalaisAxis;
  i18nKey:
    | "calibration.q_racines_horizons"
    | "calibration.q_taniere_nomade"
    | "calibration.q_exigeant_enthousiaste"
    | "calibration.q_foule_secret"
    | "calibration.q_maquis_table";
}

const QUESTIONS: QuestionDef[] = [
  { axis: "racines_horizons", i18nKey: "calibration.q_racines_horizons" },
  { axis: "taniere_nomade", i18nKey: "calibration.q_taniere_nomade" },
  { axis: "exigeant_enthousiaste", i18nKey: "calibration.q_exigeant_enthousiaste" },
  { axis: "foule_secret", i18nKey: "calibration.q_foule_secret" },
  { axis: "maquis_table", i18nKey: "calibration.q_maquis_table" },
];

export default function CalibrationScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const setCalibration = useOnboardingDraft((s) => s.setCalibration);
  const draft = useOnboardingDraft((s) => s.draft);
  const finalizeOnboarding = useSpawterStore((s) => s.finalizeOnboarding);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const total = QUESTIONS.length;
  const q = QUESTIONS[step]!;

  const choose = async (direction: "neg" | "pos" | "neutral") => {
    const value = calibrationDelta(direction);
    setCalibration(q.axis, value);

    if (step + 1 < total) {
      setStep(step + 1);
      return;
    }

    // Dernière question → finalize
    setSubmitting(true);
    try {
      await finalizeOnboarding({
        ...draft,
        calibration_answers: { ...draft.calibration_answers, [q.axis]: value },
      });
      router.replace("/(tabs)");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
    >
      <Text
        style={{
          color: theme.colors.text.tertiary,
          fontSize: theme.typography.size.sm,
          marginTop: theme.spacing.lg,
        }}
      >
        {t("onboarding.step", { current: step + 1, total })}
      </Text>
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.size["2xl"],
          fontWeight: theme.typography.weight.bold,
          marginTop: theme.spacing.sm,
          marginBottom: theme.spacing.xs,
        }}
      >
        {t("calibration.title")}
      </Text>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: theme.typography.size.base,
          marginBottom: theme.spacing.xl,
        }}
      >
        {t("calibration.subtitle")}
      </Text>

      <View
        style={{
          padding: theme.spacing.lg,
          backgroundColor: theme.colors.surface.raised,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
        }}
      >
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.size.lg,
            fontWeight: theme.typography.weight.semibold,
            marginBottom: theme.spacing.lg,
            lineHeight: theme.typography.size.lg * theme.typography.lineHeight.relaxed,
          }}
        >
          {t(`${q.i18nKey}.question` as const)}
        </Text>

        <ChoiceButton
          label={t(`${q.i18nKey}.option_neg` as const)}
          onPress={() => void choose("neg")}
          disabled={submitting}
        />
        <ChoiceButton
          label={t(`${q.i18nKey}.option_pos` as const)}
          onPress={() => void choose("pos")}
          disabled={submitting}
        />
        <ChoiceButton
          label={t(`${q.i18nKey}.option_neutral` as const)}
          onPress={() => void choose("neutral")}
          disabled={submitting}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
}

function ChoiceButton({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const theme = useTheme();
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: isPrimary
          ? theme.colors.surface.base
          : theme.colors.surface.subtle,
        paddingVertical: theme.spacing.base,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        marginBottom: theme.spacing.sm,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.size.base,
          fontWeight: theme.typography.weight.medium,
          lineHeight: theme.typography.size.base * theme.typography.lineHeight.relaxed,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
