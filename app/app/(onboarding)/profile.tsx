// Étape Profile — Story 2.4 + Story 4.8 refactor date_of_birth (FR-002 + ARTCI DR-02)
// Capture nom + quartier + 4 PII (country, origin_country, gender, date_of_birth).
// Persiste dans `useOnboardingDraft` (éphémère). La création du row spawters
// se fait en Story 2.6 (`finalizeOnboarding`).
//
// Story 4.8 — La tranche d'âge `age_range` est supprimée du draft ; le user
// saisit sa date de naissance complète via DateTimePicker natif. `age_range` est
// dérivé au finalize via `ageRangeFromDateOfBirth()` (helper pur).

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
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { track } from "../../src/lib/analytics";
import { ageRangeFromDateOfBirth } from "../../src/lib/age-range";
import type { CountryCode, Gender, ISODateString } from "../../src/types/spawter";

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

// Story 4.8 — bornes DateTimePicker.
// maximumDate = aujourd'hui (impossible de saisir une date future).
// minimumDate = cap à 100 ans (1924-01-01 par convention spec).
const DOB_MIN_DATE = new Date(1924, 0, 1);

// Formatteur fr-FR "DD MMMM YYYY" (locale française).
function formatDobFr(iso: ISODateString): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const date = new Date(y, m - 1, d);
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    // Fallback (Intl peut être indisponible en environnement de test).
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }
}

/** Convertit une `Date` JS en `YYYY-MM-DD` (timezone-agnostic, jour calendaire local). */
function dateToISO(d: Date): ISODateString {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convertit un `YYYY-MM-DD` en `Date` JS (midi local, évite ambiguïtés DST). */
function isoToDate(iso: ISODateString): Date | null {
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

// P-24 round 3 — cap synchroniquement à 50 graphèmes pour qu'un user qui colle
// un texte de 100 chars ne soit pas refusé silencieusement par la validation.
const DISPLAY_FIELD_MAX_GRAPHEMES = 50;
function capGraphemes(str: string, max: number): string {
  const chars = Array.from(str);
  if (chars.length <= max) return str;
  return chars.slice(0, max).join("");
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const draft = useOnboardingDraft((s) => s.draft);
  const setField = useOnboardingDraft((s) => s.setField);

  const [name, setName] = useState(draft.display_name);
  const [neighborhood, setNeighborhood] = useState(draft.neighborhood);
  // Story 4.8 — état local d'ouverture du DateTimePicker (Android : visible
  // uniquement on-demand ; iOS : pourra rester affiché inline).
  const [showDobPicker, setShowDobPicker] = useState(false);

  // P25 — `country_code` et `gender` ne sont jamais null (types non-null,
  // defaults CI / `non_renseigne`). Validation gardée sur les 3 vrais champs
  // exigés (display_name + neighborhood ≥ 2 chars `[\p{L}\p{N}]` + date_of_birth ≥ 13 ans).
  // P26 — exige au moins 1 lettre/chiffre dans le trim pour bloquer un nom
  // composé uniquement d'emojis/symboles.
  // P-29 — NAME_RE testé sur `.trim()` (et non la valeur brute) pour rester
  // cohérent avec la longueur trimmed.
  // P-30 — comptage en graphèmes (`Array.from(str)`) pour ne pas casser des
  // emoji surrogate pairs UTF-16. Le maxLength TextInput est bumpé à 100
  // (hard cap UTF-16) mais le `valid` borne à 50 graphèmes.
  // P-23 round 3 — `NAME_RE.test(trimmed)` ne checke que la PRÉSENCE d'au moins
  // une lettre/chiffre. Un nom `"a😀😀..."` (1 lettre + 49 emojis) passait. On
  // exige désormais ≥ 2 graphèmes alphanumériques pour bloquer ce cas tout en
  // restant tolérant aux apostrophes, traits d'union, espaces internationaux.
  const NAME_RE = /[\p{L}\p{N}]/u;
  const trimmedName = name.trim();
  const trimmedNeighborhood = neighborhood.trim();
  const nameLen = Array.from(trimmedName).length;
  const neighborhoodLen = Array.from(trimmedNeighborhood).length;
  const alphaCount = (s: string): number =>
    Array.from(s).filter((c) => NAME_RE.test(c)).length;
  // Story 4.8 — validation date_of_birth : doit être posée ET parser sur un
  // âge ≥ 13 ans (ageRangeFromDateOfBirth retourne `null` sinon).
  const dobAgeRange =
    draft.date_of_birth !== null ? ageRangeFromDateOfBirth(draft.date_of_birth) : null;
  const dobValid = draft.date_of_birth !== null && dobAgeRange !== null;
  // Distingue "pas saisi" (no message) de "saisi mais < 13 ans" (message inline).
  const dobTooYoung = draft.date_of_birth !== null && dobAgeRange === null;

  const valid =
    nameLen >= 2 &&
    nameLen <= 50 &&
    alphaCount(trimmedName) >= 2 &&
    neighborhoodLen >= 2 &&
    neighborhoodLen <= 50 &&
    alphaCount(trimmedNeighborhood) >= 2 &&
    dobValid;

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
              // P-24 round 3 — cap à 50 graphèmes côté handler. Le maxLength
              // TextInput=100 reste comme safety pour les emoji surrogate UTF-16.
              const capped = capGraphemes(v, DISPLAY_FIELD_MAX_GRAPHEMES);
              setName(capped);
              setField("display_name", capped);
            }}
            maxLength={100}
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
              // P-24 round 3 — cap symmétrique au champ display_name.
              const capped = capGraphemes(v, DISPLAY_FIELD_MAX_GRAPHEMES);
              setNeighborhood(capped);
              setField("neighborhood", capped);
            }}
            maxLength={100}
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
          <Pressable
            onPress={() => setShowDobPicker(true)}
            testID="profile-dob-trigger"
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.age_select_cta")}
            accessibilityState={{ selected: draft.date_of_birth !== null }}
            style={({ pressed }) => ({
              minHeight: 44,
              backgroundColor: theme.colors.surface.raised,
              paddingHorizontal: theme.spacing.base,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: dobTooYoung
                ? theme.colors.state.danger
                : draft.date_of_birth !== null
                  ? theme.colors.brand.primary
                  : theme.colors.border.subtle,
              opacity: pressed ? 0.85 : 1,
              justifyContent: "center",
            })}
          >
            <Text
              style={{
                color:
                  draft.date_of_birth !== null
                    ? theme.colors.text.primary
                    : theme.colors.text.tertiary,
                fontSize: theme.typography.size.base,
                fontWeight: theme.typography.weight.medium,
              }}
            >
              {draft.date_of_birth !== null
                ? formatDobFr(draft.date_of_birth)
                : t("onboarding.age_select_cta")}
            </Text>
          </Pressable>
          {dobTooYoung ? (
            <Text
              testID="profile-dob-too-young"
              style={{
                marginTop: theme.spacing.xs,
                color: theme.colors.state.danger,
                fontSize: theme.typography.size.sm,
              }}
            >
              {t("onboarding.age_too_young")}
            </Text>
          ) : null}
          {showDobPicker ? (
            <DateTimePicker
              testID="profile-dob-picker"
              value={
                draft.date_of_birth ? (isoToDate(draft.date_of_birth) ?? new Date(2000, 0, 1)) : new Date(2000, 0, 1)
              }
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              minimumDate={DOB_MIN_DATE}
              onChange={(event: DateTimePickerEvent, selected?: Date) => {
                // Android : se ferme automatiquement après dismiss/set.
                // iOS spinner : reste affiché tant qu'on ne tape pas hors champ.
                if (Platform.OS !== "ios") setShowDobPicker(false);
                if (event.type === "dismissed" || !selected) return;
                setField("date_of_birth", dateToISO(selected));
              }}
            />
          ) : null}
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
