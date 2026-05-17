// Étape Profile — Story 2.4 (FR-002 + ARTCI DR-02)
// Capture nom + quartier + 4 PII (country, origin_country, gender, age_range).
// Persiste dans `useOnboardingDraft` (éphémère). La création du row spawters
// se fait en Story 2.6 (`finalizeOnboarding`).

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { track } from "../../src/lib/analytics";
import type { AgeRange, CountryCode, Gender } from "../../src/types/spawter";

const COUNTRY_CODES: CountryCode[] = [
  "CI",
  "NG",
  "SN",
  "CM",
  "TG",
  "BJ",
  "BF",
  "ML",
  "GN",
  "GH",
];

const GENDERS: { id: Gender; labelKey: string }[] = [
  { id: "femme", labelKey: "onboarding.gender_femme" },
  { id: "homme", labelKey: "onboarding.gender_homme" },
  { id: "autre", labelKey: "onboarding.gender_autre" },
  { id: "non_renseigne", labelKey: "onboarding.gender_non_renseigne" },
];

const AGE_RANGES: AgeRange[] = ["18-24", "25-34", "35-44", "45-54", "55+"];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const draft = useOnboardingDraft((s) => s.draft);
  const setField = useOnboardingDraft((s) => s.setField);

  const [name, setName] = useState(draft.display_name);
  const [neighborhood, setNeighborhood] = useState(draft.neighborhood);

  const valid =
    name.trim().length >= 2 &&
    neighborhood.trim().length >= 2 &&
    draft.age_range !== null &&
    draft.country_code !== null &&
    draft.gender !== null;

  const onContinue = () => {
    if (!valid) return;
    track({
      name: "onboarding_step_completed",
      properties: { step: "profile", step_index: 3 },
    });
    router.push("/(onboarding)/calibration");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            ...theme.typography.preset.h1,
            color: theme.colors.text.primary,
            marginTop: theme.spacing.lg,
            marginBottom: theme.spacing.sm,
          }}
        >
          {t("onboarding.profile_title")}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.secondary,
            marginBottom: theme.spacing.xl,
          }}
        >
          {t("onboarding.profile_body")}
        </Text>

        <Field label={t("onboarding.name_title")}>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              setField("display_name", v);
            }}
            placeholder={t("onboarding.name_placeholder")}
            placeholderTextColor={theme.colors.text.tertiary}
            testID="profile-name"
            style={inputStyle(theme)}
          />
        </Field>

        <Field
          label={t("onboarding.neighborhood_title")}
          hint={t("onboarding.neighborhood_body")}
        >
          <TextInput
            value={neighborhood}
            onChangeText={(v) => {
              setNeighborhood(v);
              setField("neighborhood", v);
            }}
            placeholder={t("onboarding.neighborhood_placeholder")}
            placeholderTextColor={theme.colors.text.tertiary}
            testID="profile-neighborhood"
            style={inputStyle(theme)}
          />
        </Field>

        <Field
          label={t("onboarding.country_title")}
          hint={t("onboarding.country_body")}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {COUNTRY_CODES.map((c) => (
              <Choice
                key={c}
                label={t(`onboarding.country.${c}`)}
                selected={draft.country_code === c}
                onPress={() => setField("country_code", c)}
                testID={`profile-country-${c}`}
              />
            ))}
          </View>
        </Field>

        <Field
          label={t("onboarding.origin_country_title")}
          hint={t("onboarding.origin_country_body")}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            <Choice
              label={t("onboarding.origin_country_skip")}
              selected={draft.origin_country_code === null}
              onPress={() => setField("origin_country_code", null)}
              testID="profile-origin-skip"
            />
            {COUNTRY_CODES.map((c) => (
              <Choice
                key={c}
                label={t(`onboarding.country.${c}`)}
                selected={draft.origin_country_code === c}
                onPress={() => setField("origin_country_code", c)}
                testID={`profile-origin-${c}`}
              />
            ))}
          </View>
        </Field>

        <Field
          label={t("onboarding.gender_title")}
          hint={t("onboarding.gender_body")}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {GENDERS.map((g) => (
              <Choice
                key={g.id}
                label={t(g.labelKey)}
                selected={draft.gender === g.id}
                onPress={() => setField("gender", g.id)}
                testID={`profile-gender-${g.id}`}
              />
            ))}
          </View>
        </Field>

        <Field
          label={t("onboarding.age_title")}
          hint={t("onboarding.age_body")}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {AGE_RANGES.map((r) => (
              <Choice
                key={r}
                label={r}
                selected={draft.age_range === r}
                onPress={() => setField("age_range", r)}
                testID={`profile-age-${r}`}
              />
            ))}
          </View>
        </Field>

        <Pressable
          disabled={!valid}
          onPress={onContinue}
          testID="profile-continue"
          accessibilityRole="button"
          accessibilityState={{ disabled: !valid }}
          style={({ pressed }) => ({
            marginTop: theme.spacing.xl,
            backgroundColor: valid
              ? theme.colors.brand.accent
              : theme.colors.border.subtle,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.lg,
            opacity: valid && pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: valid ? theme.colors.text.inverse : theme.colors.text.tertiary,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              textAlign: "center",
            }}
          >
            {t("common.continue")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.size.base,
          fontWeight: theme.typography.weight.medium,
          marginBottom: theme.spacing.xs,
        }}
      >
        {label}
      </Text>
      {hint ? (
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.typography.size.sm,
            marginBottom: theme.spacing.sm,
          }}
        >
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: "center",
        backgroundColor: selected
          ? theme.colors.brand.primary
          : theme.colors.surface.raised,
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: selected ? theme.colors.brand.primary : theme.colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? theme.colors.text.onBrand : theme.colors.text.primary,
          fontSize: theme.typography.size.sm,
          fontWeight: theme.typography.weight.medium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>) {
  return {
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.base,
    color: theme.colors.text.primary,
    fontSize: theme.typography.size.base,
    backgroundColor: theme.colors.surface.raised,
  } as const;
}
