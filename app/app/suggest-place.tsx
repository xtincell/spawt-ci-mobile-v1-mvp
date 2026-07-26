// Feature 18 — Suggestion de lieu par la Meute (migration 0039).
// La communauté propose, l'humain décide : formulaire (nom requis, commune
// Select, repère descriptif, description, GPS optionnel, 1-3 photos) +
// liste « Tes suggestions » avec statut. Quota : 5 pending max (trigger DB,
// miroir local en démo) → message dédié, voix du Chat.
//
// Flag `suggestions-lieux` OFF par défaut (seed v2) → entrées masquées ET
// deep link redirigé vers le feed (défense en profondeur, pattern rapide).

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { Ico } from "../src/components/primitives/Ico";
import { Select } from "../src/components/primitives/Select";
import { getActiveCity } from "../src/lib/city";
import {
  isSupabaseConfigured,
  listMySuggestions,
  submitPlaceSuggestion,
} from "../src/lib/data-source";
import type { PlaceSuggestionRow } from "../src/lib/place-suggestions";
import { compressPhoto, uploadReviewPhoto } from "../src/lib/storage-photos";
import { useSpawterPosition } from "../src/lib/use-spawter-position";
import { useSpawterStore } from "../src/store/spawter-store";
import { useFlag } from "../src/store/feature-flags";
import { track } from "../src/lib/analytics";

const PHOTO_MAX = 3;
const DESCRIPTION_MAX = 1000;

export default function SuggestPlaceScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  // Tous les hooks AVANT tout early return (leçon R22 — rules of hooks).
  const enabled = useFlag("suggestions-lieux");
  const spawter = useSpawterStore((s) => s.spawter);
  const position = useSpawterPosition();

  const [name, setName] = useState("");
  const [communeKey, setCommuneKey] = useState<string | null>(null);
  const [landmark, setLandmark] = useState("");
  const [description, setDescription] = useState("");
  const [attachGps, setAttachGps] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState<PlaceSuggestionRow[]>([]);

  const refreshMine = useCallback(async () => {
    if (!spawter) return;
    const rows = await listMySuggestions(spawter.id);
    setMine(rows);
  }, [spawter]);

  useEffect(() => {
    if (!enabled) return;
    void refreshMine();
  }, [enabled, refreshMine]);

  if (!enabled || !spawter) {
    return <Redirect href="/(tabs)" />;
  }

  // Multi-villes — communes de la ville active (codes canoniques) ; le
  // libellé privilégie la clé i18n `onboarding.commune.<code>` si elle
  // existe (convention onboarding), sinon le nom porté par la config ville.
  const communeOptions = getActiveCity().communes.map((c) => {
    const i18nKey = `onboarding.commune.${c.code}`;
    const label = t(i18nKey);
    return { key: c.code, label: label === i18nKey ? c.name : label };
  });
  const communeLabel =
    communeOptions.find((o) => o.key === communeKey)?.label ?? null;

  const gpsAvailable = position.source === "gps";

  const addPhoto = async () => {
    if (photoUris.length >= PHOTO_MAX) return;
    try {
      const mod = await import("expo-image-picker");
      const ImagePicker = mod.default ?? mod;
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const compressed = await compressPhoto(result.assets[0].uri);
      setPhotoUris((prev) => [...prev, compressed]);
    } catch (err) {
      if (__DEV__) console.warn("[suggest-place] photo add failed", err);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== idx));
  };

  const valid = name.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      // Photos : upload bucket place-photos sous le sous-dossier RLS du
      // spawter (mode supabase) ; en démo les URIs locales suffisent.
      let photo_urls = photoUris;
      if (isSupabaseConfigured && photoUris.length > 0) {
        const ref = `suggestion-${Date.now().toString(36)}`;
        const uploaded: string[] = [];
        for (let i = 0; i < photoUris.length; i++) {
          const path = await uploadReviewPhoto(
            photoUris[i]!,
            spawter.id,
            ref,
            i as 0 | 1 | 2,
          );
          if (path) uploaded.push(path);
        }
        photo_urls = uploaded;
      }

      const result = await submitPlaceSuggestion(spawter.id, {
        name: name.trim(),
        commune: communeLabel,
        neighborhood: landmark.trim().length > 0 ? landmark.trim() : null,
        description: description.trim().length > 0 ? description.trim() : null,
        lat: attachGps && gpsAvailable ? position.lat : null,
        lng: attachGps && gpsAvailable ? position.lng : null,
        photo_urls,
      });

      if (result === "ok") {
        track({
          name: "place_suggestion_submitted",
          properties: { has_gps: attachGps && gpsAvailable, photos: photo_urls.length },
        });
        setName("");
        setCommuneKey(null);
        setLandmark("");
        setDescription("");
        setPhotoUris([]);
        setAttachGps(false);
        await refreshMine();
        Alert.alert(t("suggest.success_title"), t("suggest.success_body"));
      } else if (result === "quota_exceeded") {
        Alert.alert(t("suggest.quota_title"), t("suggest.quota_body"));
      } else {
        Alert.alert(t("suggest.error_title"), t("suggest.error_body"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: theme.spacing.base,
            paddingVertical: theme.spacing.sm,
            gap: theme.spacing.base,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <Ico name="arrow-left" size={22} />
          </Pressable>
          <Text
            style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}
          >
            {t("suggest.title")}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.lg,
            paddingBottom: theme.spacing["2xl"],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}
          >
            {t("suggest.subtitle")}
          </Text>

          {/* Nom — seul champ requis. */}
          <Field label={t("suggest.field_name")}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("suggest.name_placeholder")}
              placeholderTextColor={theme.colors.text.tertiary}
              maxLength={120}
              testID="suggest-name-input"
              accessibilityLabel={t("suggest.field_name")}
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.primary,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.base,
                paddingVertical: theme.spacing.sm,
                minHeight: 48,
              }}
            />
          </Field>

          {/* Commune — Select des communes de la ville active. */}
          <Field label={t("suggest.field_commune")}>
            <Select
              placeholder={t("suggest.commune_placeholder")}
              options={communeOptions}
              value={communeKey}
              onChange={setCommuneKey}
              testID="suggest-commune-select"
              accessibilityLabel={t("suggest.commune_aria")}
            />
          </Field>

          {/* Repère descriptif — l'adresse à l'ivoirienne. */}
          <Field label={t("suggest.field_landmark")}>
            <TextInput
              value={landmark}
              onChangeText={setLandmark}
              placeholder={t("suggest.landmark_placeholder")}
              placeholderTextColor={theme.colors.text.tertiary}
              maxLength={200}
              testID="suggest-landmark-input"
              accessibilityLabel={t("suggest.field_landmark")}
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.primary,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.base,
                paddingVertical: theme.spacing.sm,
                minHeight: 48,
              }}
            />
          </Field>

          <Field label={t("suggest.field_description")}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("suggest.description_placeholder")}
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              maxLength={DESCRIPTION_MAX}
              testID="suggest-description-input"
              accessibilityLabel={t("suggest.field_description")}
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.primary,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.base,
                paddingVertical: theme.spacing.sm,
                minHeight: 96,
                textAlignVertical: "top",
              }}
            />
          </Field>

          {/* GPS optionnel — position réelle uniquement (jamais le fallback
              ville : suggérer un spot depuis son canapé n'a pas de sens). */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.base,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}
              >
                {t("suggest.gps_label")}
              </Text>
              <Text
                style={{ ...theme.typography.preset.small, color: theme.colors.text.tertiary }}
              >
                {gpsAvailable ? t("suggest.gps_hint") : t("suggest.gps_unavailable")}
              </Text>
            </View>
            <Switch
              testID="suggest-gps-switch"
              value={attachGps && gpsAvailable}
              disabled={!gpsAvailable}
              onValueChange={setAttachGps}
              trackColor={{ true: theme.colors.brand.primary, false: undefined }}
            />
          </View>

          {/* Photos 0-3 — appui long pour retirer. */}
          <View style={{ gap: theme.spacing.sm }}>
            <Text
              style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}
            >
              {t("suggest.section_photos")}
            </Text>
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              {photoUris.map((uri, idx) => (
                <Pressable
                  key={uri}
                  onLongPress={() => removePhoto(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={t("suggest.photo_remove")}
                  testID={`suggest-photo-${idx}`}
                >
                  <Image
                    source={{ uri }}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: theme.radius.md,
                    }}
                  />
                </Pressable>
              ))}
              {photoUris.length < PHOTO_MAX ? (
                <Pressable
                  onPress={() => {
                    void addPhoto();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("suggest.photo_add")}
                  testID="suggest-photo-add"
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: theme.colors.border.strong,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ico name="camera" size={24} color={theme.colors.text.tertiary} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* CTA — voix du Chat au retour. */}
          <Pressable
            onPress={() => {
              void handleSubmit();
            }}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={t("suggest.cta_submit")}
            testID="suggest-submit"
            style={({ pressed }) => ({
              backgroundColor: valid
                ? theme.colors.brand.primary
                : theme.colors.surface.raised,
              paddingVertical: theme.spacing.base,
              borderRadius: theme.radius.full,
              alignItems: "center",
              minHeight: 48,
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                ...theme.typography.preset.h3,
                color: valid ? theme.colors.text.onBrand : theme.colors.text.tertiary,
              }}
            >
              {submitting ? t("suggest.sending") : t("suggest.cta_submit")}
            </Text>
          </Pressable>

          {/* Tes suggestions — statut pending/approved/rejected + motif. */}
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.base }}>
            <Text
              style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}
            >
              {t("suggest.mine_title")}
            </Text>
            {mine.length === 0 ? (
              <Text
                style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}
              >
                {t("suggest.mine_empty")}
              </Text>
            ) : (
              mine.map((row) => <SuggestionRow key={row.id} row={row} />)
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

/** Ligne d'une suggestion envoyée : nom + statut + motif de refus éventuel. */
function SuggestionRow({ row }: { row: PlaceSuggestionRow }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const statusColor =
    row.status === "approved"
      ? theme.colors.state.success
      : row.status === "rejected"
        ? theme.colors.state.danger
        : theme.colors.text.tertiary;
  return (
    <View
      testID={`suggestion-row-${row.id}`}
      style={{
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.subtle,
        gap: theme.spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: theme.spacing.base,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.primary,
            flex: 1,
          }}
        >
          {row.name}
        </Text>
        <Text style={{ ...theme.typography.preset.caption, color: statusColor }}>
          {t(`suggest.status_${row.status}`)}
        </Text>
      </View>
      {row.status === "rejected" && row.rejection_reason ? (
        <Text
          style={{ ...theme.typography.preset.small, color: theme.colors.text.tertiary }}
        >
          {t("suggest.rejection_prefix", { reason: row.rejection_reason })}
        </Text>
      ) : null}
    </View>
  );
}
