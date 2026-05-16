// Étape 2 onboarding — Nom + quartier + démographique
// Conformité ARTCI : la collecte démographique est explicite (cf. consent.tsx)

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import type { AgeRange, Gender } from "../../src/types/spawter";

const GENDERS: { id: Gender; label: string }[] = [
  { id: "femme", label: "Femme" },
  { id: "homme", label: "Homme" },
  { id: "autre", label: "Autre" },
  { id: "non_renseigne", label: "Préfère ne pas dire" },
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

  const valid = name.trim().length >= 2 && neighborhood.trim().length >= 2;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.size["2xl"],
          fontWeight: theme.typography.weight.bold,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.lg,
        }}
      >
        {t("onboarding.name_title")}
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
          style={inputStyle(theme)}
        />
      </Field>

      <Field label={t("onboarding.neighborhood_title")} hint={t("onboarding.neighborhood_body")}>
        <TextInput
          value={neighborhood}
          onChangeText={(v) => {
            setNeighborhood(v);
            setField("neighborhood", v);
          }}
          placeholder="Cocody, Yopougon, Marcory…"
          placeholderTextColor={theme.colors.text.tertiary}
          style={inputStyle(theme)}
        />
      </Field>

      <Field label={t("onboarding.demographics_age_title")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {AGE_RANGES.map((r) => (
            <Choice
              key={r}
              label={r}
              selected={draft.age_range === r}
              onPress={() => setField("age_range", r)}
            />
          ))}
        </View>
      </Field>

      <Field label={t("onboarding.demographics_gender_title")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {GENDERS.map((g) => (
            <Choice
              key={g.id}
              label={g.label}
              selected={draft.gender === g.id}
              onPress={() => setField("gender", g.id)}
            />
          ))}
        </View>
      </Field>

      <Pressable
        disabled={!valid}
        onPress={() => router.push("/(onboarding)/calibration")}
        style={({ pressed }) => ({
          marginTop: theme.spacing.xl,
          backgroundColor: valid ? theme.colors.brand.accent : theme.colors.border.subtle,
          paddingVertical: theme.spacing.base,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.85 : 1,
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
      {hint && (
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.typography.size.sm,
            marginBottom: theme.spacing.sm,
          }}
        >
          {hint}
        </Text>
      )}
      {children}
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? theme.colors.brand.primary : theme.colors.surface.raised,
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
