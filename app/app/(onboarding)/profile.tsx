// Étape Profile — Story 2.4 + Story 4.8 refactor date_of_birth (FR-002 + ARTCI DR-02)
// Capture nom + commune + 4 PII (country, origin_country, gender, date_of_birth).
// Persiste dans `useOnboardingDraft` (éphémère). La création du row spawters
// se fait en Story 2.6 (`finalizeOnboarding`).
//
// Story 4.8 — La tranche d'âge `age_range` est supprimée du draft ; le spawter
// saisit sa date de naissance complète via DateTimePicker natif. `age_range` est
// dérivé au finalize via `ageRangeFromDateOfBirth()` (helper pur).
//
// Retours alpha R1-R4 :
//   R1 — la saisie libre du quartier devient un `Select` des communes d'Abidjan
//        (la valeur lisible, ex. « Cocody », s'écrit dans `draft.neighborhood`) ;
//   R2 — texte d'aide sous « Ta commune » ;
//   R3 — Pays de résidence & Pays d'origine passent des grilles de pastilles
//        à des `Select` (option skip de Pays d'origine conservée) ;
//   R4 — le champ date de naissance affiche le gabarit jj/mm/aaaa (vide) et la
//        date au format jj/mm/aaaa (remplie), avec texte d'aide dédié.

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
import { Select } from "../../src/components/primitives/Select";
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

// R1 — communes d'Abidjan (13 communes + Anyama/Bingerville/Songon du Grand
// Abidjan déjà inclus) + échappatoire « Autre / hors Abidjan ». Clés i18n
// `onboarding.commune.<slug>` ; la valeur écrite dans le draft est le libellé
// lisible (ex. « Cocody ») — le champ `neighborhood` existant reste inchangé.
const COMMUNE_KEYS = [
  "abobo",
  "adjame",
  "anyama",
  "attecoube",
  "bingerville",
  "cocody",
  "koumassi",
  "marcory",
  "plateau",
  "port_bouet",
  "songon",
  "treichville",
  "yopougon",
  "autre",
] as const;

// R3 — clé sentinelle de l'option « Préfère ne pas dire » du Select Pays
// d'origine (jamais en collision avec un code pays ISO à 2 lettres).
const ORIGIN_SKIP_KEY = "skip";

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

// R4 — affichage jj/mm/aaaa, aligné sur le gabarit du placeholder
// (`onboarding.dob_placeholder`).
function formatDob(iso: ISODateString): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
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
  // Story 4.8 — état local d'ouverture du DateTimePicker (Android : visible
  // uniquement on-demand ; iOS : pourra rester affiché inline).
  const [showDobPicker, setShowDobPicker] = useState(false);

  // R4 (web) — @react-native-community/datetimepicker n'a PAS d'implémentation
  // navigateur : sur la préversion web, le champ date est une saisie MASQUÉE
  // jj/mm/aaaa (l'option « placeholder + masque » de la note produit). La date
  // n'est écrite dans le draft que complète ET réelle ; sinon null (Continue
  // reste gaté par dobValid comme sur natif).
  const [dobText, setDobText] = useState<string>(() =>
    draft.date_of_birth ? formatDob(draft.date_of_birth) : "",
  );
  const onDobTextChange = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 8);
    const masked =
      digits.length > 4
        ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
        : digits.length > 2
          ? `${digits.slice(0, 2)}/${digits.slice(2)}`
          : digits;
    setDobText(masked);
    if (digits.length === 8) {
      const d = Number(digits.slice(0, 2));
      const m = Number(digits.slice(2, 4));
      const y = Number(digits.slice(4));
      const date = new Date(y, m - 1, d, 12, 0, 0);
      const isRealDate =
        date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
      const inBounds = date >= DOB_MIN_DATE && date <= new Date();
      setField("date_of_birth", isRealDate && inBounds ? dateToISO(date) : null);
    } else {
      setField("date_of_birth", null);
    }
  };

  // R1 — options du Select commune (libellés i18n) + clé courante retrouvée
  // depuis le libellé stocké dans le draft (round-trip back-nav).
  const communeOptions = COMMUNE_KEYS.map((k) => ({
    key: k,
    label: t(`onboarding.commune.${k}`),
  }));
  const communeValue =
    COMMUNE_KEYS.find((k) => t(`onboarding.commune.${k}`) === draft.neighborhood) ?? null;

  // R3 — options des Select pays (mêmes listes/clés i18n que les anciennes
  // grilles de pastilles). Pays d'origine : option skip en tête.
  const countryOptions = COUNTRY_CODES.map((c) => ({
    key: c,
    label: t(`onboarding.country.${c}`),
  }));
  const originOptions = [
    { key: ORIGIN_SKIP_KEY, label: t("onboarding.origin_country_skip") },
    ...countryOptions,
  ];

  // P25 — `country_code` et `gender` ne sont jamais null (types non-null,
  // defaults CI / `non_renseigne`). Validation gardée sur les 3 vrais champs
  // exigés (display_name ≥ 2 chars `[\p{L}\p{N}]` + commune choisie +
  // date_of_birth ≥ 13 ans).
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
  const nameLen = Array.from(trimmedName).length;
  const alphaCount = (s: string): number =>
    Array.from(s).filter((c) => NAME_RE.test(c)).length;
  // R1 — la commune vient d'une liste fermée (Select) : « choisie » suffit.
  const communeChosen = draft.neighborhood.trim().length > 0;
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
    communeChosen &&
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
          {/* R1/R2 — Select des communes d'Abidjan ; écrit le libellé lisible
              (ex. « Cocody ») dans le champ existant `draft.neighborhood`. */}
          <Select
            placeholder={t("onboarding.neighborhood_placeholder")}
            value={communeValue}
            options={communeOptions}
            onChange={(key) => setField("neighborhood", t(`onboarding.commune.${key}`))}
            testID="profile-commune"
            accessibilityLabel={t("onboarding.neighborhood_title")}
          />
        </Field>

        <Field
          label={t("onboarding.country_title")}
          hint={t("onboarding.country_body")}
        >
          {/* R3 — grille de pastilles → Select (mêmes pays, mêmes clés i18n). */}
          <Select
            placeholder={t("onboarding.country_placeholder")}
            value={draft.country_code}
            options={countryOptions}
            onChange={(key) => {
              const code = COUNTRY_CODES.find((c) => c === key);
              if (code) setField("country_code", code);
            }}
            testID="profile-country"
            accessibilityLabel={t("onboarding.country_title")}
          />
        </Field>

        <Field
          label={t("onboarding.origin_country_title")}
          hint={t("onboarding.origin_country_body")}
        >
          {/* R3 — Select avec option skip conservée (clé sentinelle → null).
              Champ maintenu tel quel — question produit ouverte signalée
              ailleurs. */}
          <Select
            placeholder={t("onboarding.country_placeholder")}
            value={draft.origin_country_code ?? ORIGIN_SKIP_KEY}
            options={originOptions}
            onChange={(key) => {
              const code = COUNTRY_CODES.find((c) => c === key) ?? null;
              setField("origin_country_code", code);
            }}
            testID="profile-origin"
            accessibilityLabel={t("onboarding.origin_country_title")}
          />
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
          {Platform.OS === "web" ? (
            /* R4 (web) — saisie masquée jj/mm/aaaa (pas de picker natif en
               navigateur). Même gabarit, même validation via le draft. */
            <TextInput
              value={dobText}
              onChangeText={onDobTextChange}
              placeholder={t("onboarding.dob_placeholder")}
              placeholderTextColor={theme.colors.text.tertiary}
              keyboardType="number-pad"
              maxLength={10}
              testID="profile-dob-web"
              accessibilityLabel={t("onboarding.age_select_cta")}
              style={{
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
                color: theme.colors.text.primary,
                fontSize: theme.typography.size.base,
              }}
            />
          ) : (
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
                {/* R4 — gabarit jj/mm/aaaa quand vide, date jj/mm/aaaa sinon. */}
                {draft.date_of_birth !== null
                  ? formatDob(draft.date_of_birth)
                  : t("onboarding.dob_placeholder")}
              </Text>
            </Pressable>
          )}
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
