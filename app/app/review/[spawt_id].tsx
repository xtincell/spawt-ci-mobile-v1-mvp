// Story 4.5 — Écran modal d'avis structuré post-spawt.
// Note (1-5 obligatoire) + 5 tags multi-select + texte 500c max + 0-3 photos.
// Latence cible : submit < 2min (compression photos + upload).

import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../src/theme/ThemeProvider";
import { Stars } from "../../src/components/primitives/Stars";
import { Chip } from "../../src/components/primitives/Chip";
import { useSpawterStore } from "../../src/store/spawter-store";
import {
  REVIEW_TAGS,
  REVIEW_TAG_LABELS,
  type ReviewTag,
} from "../../src/types/spawt";
import { track } from "../../src/lib/analytics";
import {
  compressPhoto,
  uploadReviewPhoto,
} from "../../src/lib/storage-photos";

const TEXT_MAX = 500;
const PHOTO_MAX = 3;

export default function ReviewScreen() {
  const params = useLocalSearchParams<{ spawt_id: string; entry?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const spawts = useSpawterStore((s) => s.spawts);
  const spawter = useSpawterStore((s) => s.spawter);
  const attachReviewToSpawt = useSpawterStore((s) => s.attachReviewToSpawt);

  const spawt = useMemo(
    () => spawts.find((s) => s.id === params.spawt_id),
    [spawts, params.spawt_id],
  );

  const [note, setNote] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [text, setText] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // review_started event (1 émission par mount).
  const startedRef = useMemo(() => ({ emitted: false }), []);
  if (spawt && !startedRef.emitted) {
    startedRef.emitted = true;
    const entry_point: "post_spawt" | "place_detail" =
      params.entry === "place_detail" ? "place_detail" : "post_spawt";
    track({
      name: "review_started",
      properties: { place_id: spawt.place_id, entry_point },
    });
  }

  const toggleTag = useCallback((tag: ReviewTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
  }, []);

  const addPhoto = useCallback(async () => {
    if (photoUris.length >= PHOTO_MAX) return;
    try {
      const mod = await import("expo-image-picker");
      const ImagePicker = mod.default ?? mod;
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          t("review.permission_title", { defaultValue: "Permission requise" }),
          t("review.permission_body", {
            defaultValue:
              "Pour ajouter une photo, autorise l'accès à ta galerie.",
          }),
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const localUri = result.assets[0].uri;
      const compressed = await compressPhoto(localUri);
      setPhotoUris((prev) => [...prev, compressed]);
      track({
        name: "review_photo_added",
        properties: {
          place_id: spawt?.place_id ?? "",
          photos_count_now: photoUris.length + 1,
        },
      });
    } catch (err) {
      if (__DEV__) console.warn("[review] photo add failed", err);
    }
  }, [photoUris, spawt, t]);

  const removePhoto = (idx: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!spawt || !spawter || note === null) return;
    setSubmitting(true);
    try {
      // Upload photos séquentiel. Échec silencieux par photo (UX dégradé acceptable V1).
      const uploadedPaths: string[] = [];
      for (let i = 0; i < photoUris.length; i++) {
        const idx = i as 0 | 1 | 2;
        const path = await uploadReviewPhoto(
          photoUris[i]!,
          spawter.id,
          spawt.id,
          idx,
        );
        if (path) uploadedPaths.push(path);
      }
      await attachReviewToSpawt(spawt.id, {
        note_etoiles: note,
        texte_avis: text.trim().length > 0 ? text.trim() : null,
        tags,
        photos: uploadedPaths,
      });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const handleLater = () => {
    track({
      name: "review_abandoned",
      properties: {
        place_id: spawt?.place_id ?? "",
        had_note: note !== null,
      },
    });
    router.back();
  };

  if (!spawt) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      >
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: theme.colors.text.secondary }}>
            {t("review.spawt_not_found", { defaultValue: "Spawt introuvable" })}
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.brand.accent }}>
              {t("common.back")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const submitDisabled = submitting || note === null;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120 }}
      >
        <Text
          style={{
            ...theme.typography.preset.display,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.xs,
          }}
        >
          {t("review.title", { place_name: spawt.place_id })}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.secondary,
            marginBottom: theme.spacing.lg,
          }}
        >
          {t("review.subtitle")}
        </Text>

        {/* Note */}
        <Text
          style={{
            ...theme.typography.preset.h3,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.sm,
          }}
        >
          {t("review.section_note", { defaultValue: "Ta note" })}
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.base,
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} étoile${n > 1 ? "s" : ""}`}
              onPress={() => setNote(n as 1 | 2 | 3 | 4 | 5)}
            >
              <Stars value={note !== null && n <= note ? 1 : 0} max={1} />
            </Pressable>
          ))}
        </View>
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.tertiary,
            marginBottom: theme.spacing.lg,
          }}
        >
          {t("review.stars_hint")}
        </Text>

        {/* Tags */}
        <Text
          style={{
            ...theme.typography.preset.h3,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.sm,
          }}
        >
          {t("review.section_tags", { defaultValue: "Mots-clés" })}
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.lg,
          }}
        >
          {REVIEW_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={REVIEW_TAG_LABELS[tag]}
              onPress={() => toggleTag(tag)}
              variant={tags.includes(tag) ? "gold" : "outline"}
              selected={tags.includes(tag)}
            />
          ))}
        </View>

        {/* Texte libre */}
        <Text
          style={{
            ...theme.typography.preset.h3,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.sm,
          }}
        >
          {t("review.section_text", { defaultValue: "Ton mot" })}
        </Text>
        <TextInput
          multiline
          maxLength={TEXT_MAX}
          value={text}
          onChangeText={setText}
          placeholder={t("review.text_placeholder")}
          placeholderTextColor={theme.colors.text.tertiary}
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.primary,
            minHeight: 96,
            padding: theme.spacing.base,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            borderRadius: theme.radius.md,
            marginBottom: theme.spacing.xs,
            textAlignVertical: "top",
          }}
        />
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.tertiary,
            textAlign: "right",
            marginBottom: theme.spacing.lg,
          }}
        >
          {text.length}/{TEXT_MAX}
        </Text>

        {/* Photos */}
        <Text
          style={{
            ...theme.typography.preset.h3,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.sm,
          }}
        >
          {t("review.section_photos", { defaultValue: "Photos (0-3)" })}
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.lg,
          }}
        >
          {photoUris.map((uri, idx) => (
            <Pressable
              key={uri}
              onLongPress={() => removePhoto(idx)}
              accessibilityRole="button"
              accessibilityLabel={t("review.photo_remove", {
                defaultValue: "Retirer (long press)",
              })}
              style={{
                width: 80,
                height: 80,
                backgroundColor: theme.colors.surface.subtle,
                borderRadius: theme.radius.md,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: theme.colors.text.tertiary }}>📷</Text>
            </Pressable>
          ))}
          {photoUris.length < PHOTO_MAX ? (
            <Pressable
              onPress={() => {
                void addPhoto();
              }}
              accessibilityRole="button"
              accessibilityLabel={t("review.photo_add")}
              style={{
                width: 80,
                height: 80,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: theme.colors.border.strong,
                borderRadius: theme.radius.md,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: theme.colors.text.secondary }}>+</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky CTAs */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: theme.spacing.lg,
          backgroundColor: theme.colors.surface.base,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.subtle,
          gap: theme.spacing.sm,
        }}
      >
        <Pressable
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitDisabled }}
          accessibilityLabel={t("review.cta_save")}
          style={({ pressed }) => ({
            backgroundColor: theme.colors.brand.accent,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.lg,
            opacity: submitDisabled ? 0.5 : pressed ? 0.85 : 1,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.h3,
              color: theme.colors.text.inverse,
            }}
          >
            {t("review.cta_save")}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleLater}
          accessibilityRole="button"
          accessibilityLabel={t("review.cta_later")}
          style={({ pressed }) => ({
            paddingVertical: theme.spacing.sm,
            opacity: pressed ? 0.7 : 1,
            alignItems: "center",
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.secondary,
            }}
          >
            {t("review.cta_later")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
