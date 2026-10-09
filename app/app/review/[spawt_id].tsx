import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";
import { Stars } from "../../src/components/primitives/Stars";
import { Chip } from "../../src/components/primitives/Chip";
import { useSpawterStore } from "../../src/store/spawter-store";
import { REVIEW_TAGS, } from "../../src/types/spawt";
import { track } from "../../src/lib/analytics";
import { compressPhoto, uploadReviewPhoto } from "../../src/lib/storage-photos";
import { getPlace, isSupabaseConfigured } from "../../src/lib/data-source";
import { globalReviewRating, legacyReviewRating, readReviewRatings, type StarRating } from "../../src/lib/review-ratings";
import { clearReviewDraft, loadReviewDraft, persistDraftPhoto, removeDraftPhotos, saveReviewDraft, type ReviewDraft } from "../../src/lib/review-drafts";
import { notifyReviewChanged } from "../../src/lib/review-events";

const EMPTY_DRAFT: ReviewDraft = { note_cuisine: null, note_cadre: null, note_service: null, tags: [], text: "", photoUris: [] };
const CRITERIA = ["note_cuisine", "note_cadre", "note_service"] as const;

export default function ReviewScreen() {
  const params = useLocalSearchParams<{ spawt_id: string; entry?: string; place_name?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const spawts = useSpawterStore(s => s.spawts);
  const spawter = useSpawterStore(s => s.spawter);
  const attachReview = useSpawterStore(s => s.attachReviewToSpawt);
  const spawt = useMemo(() => spawts.find(s => s.id === params.spawt_id && s.spawter_id === spawter?.id && !s.is_seed && !s.is_cancelled), [spawts, params.spawt_id, spawter?.id]);
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const photoBusy = useRef(false);
  const published = useRef(false);
  const placeId = spawt?.place_id;
  const ownerId = spawter?.id;
  const spawtId = spawt?.id;
  const ratings = readReviewRatings(draft);

  useEffect(() => {
    if (!ownerId || !spawtId) return;
    let active = true;
    setReady(false);
    loadReviewDraft(ownerId, spawtId).then(saved => {
      if (active) { setDraft(saved ?? EMPTY_DRAFT); setPlaceName(current => saved?.placeName ?? params.place_name ?? current); setReady(true); }
    }).catch(() => { if (active) setError(t("review.draft_failed")); });
    return () => { active = false; };
  }, [ownerId, spawtId, params.place_name, t]);

  useEffect(() => {
    if (!ready || !ownerId || !spawtId || published.current) return;
    void saveReviewDraft(ownerId, spawtId, { ...draft, placeName }).catch(() => setError(t("review.draft_failed")));
  }, [draft, ready, ownerId, spawtId, placeName, t]);

  useEffect(() => {
    if (!placeId) return;
    let active = true;
    void getPlace(placeId).then(place => { if (active) setPlaceName(current => place?.name ?? current); }).catch(() => undefined);
    track({ name: "review_started", properties: { place_id: placeId, entry_point: params.entry === "place_detail" ? "place_detail" : "post_spawt" } });
    return () => { active = false; };
  }, [placeId, params.entry]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else if (placeId) router.replace(`/place/${placeId}`);
    else router.replace("/(tabs)");
  }, [router, placeId]);

  const addPhoto = async () => {
    if (!ownerId || !spawtId || photoBusy.current || busy.current || draft.photoUris.length >= 3) return;
    photoBusy.current = true; setAddingPhoto(true);
    try {
      const picker = await import("expo-image-picker");
      const perm = await picker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") { Alert.alert(t("review.permission_title"), t("review.permission_body")); return; }
      const result = await picker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const compressed = await compressPhoto(result.assets[0].uri);
      const uri = await persistDraftPhoto(compressed, ownerId, spawtId);
      setDraft(prev => ({ ...prev, photoUris: [...prev.photoUris, uri].slice(0, 3) }));
      track({ name: "review_photo_added", properties: { place_id: placeId ?? "", photos_count_now: draft.photoUris.length + 1 } });
    } catch (err) {
      if (__DEV__) console.warn("[review] photo add failed", err);
      setError(t("review.photo_failed"));
    } finally { photoBusy.current = false; setAddingPhoto(false); }
  };

  const submit = async () => {
    if (!spawt || !ownerId || !ratings || !ready || busy.current || photoBusy.current) return;
    busy.current = true; setSubmitting(true); setError(null);
    try {
      await saveReviewDraft(ownerId, spawt.id, { ...draft, placeName });
      const paths: string[] = [];
      for (let i = 0; i < draft.photoUris.length; i++) {
        const path = isSupabaseConfigured
          ? await uploadReviewPhoto(draft.photoUris[i]!, ownerId, spawt.id, i as 0 | 1 | 2)
          : draft.photoUris[i]!;
        if (!path) throw new Error("review_photo_upload_failed");
        paths.push(path);
      }
      const result = await attachReview(spawt.id, { ...ratings, note_etoiles: legacyReviewRating(ratings), texte_avis: draft.text.trim() || null, tags: draft.tags, photos: paths });
      published.current = true;
      // Un échec de nettoyage ne transforme pas un avis reçu en échec de publication.
      try { await clearReviewDraft(ownerId, spawt.id); await removeDraftPhotos(draft.photoUris); } catch { /* Best effort. */ }
      notifyReviewChanged(spawt.place_id);
      Alert.alert(t(result.persisted === "queued" ? "review.queued_title" : "review.published_title"),
        t(result.persisted === "queued" ? "review.queued_body" : result.persisted === "local" ? "review.demo_body" : "review.published_body"),
        [{ text: t("common.ok"), onPress: close }], { cancelable: false });
    } catch (err) {
      if (__DEV__) console.warn("[review] submit failed", err);
      setError(t("review.publish_failed"));
      Alert.alert(t("review.publish_error_title"), t("review.publish_failed"));
      busy.current = false;
    } finally { setSubmitting(false); }
  };

  if (!spawt) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <View style={{ flex: 1, padding: theme.spacing.lg, justifyContent: "center", alignItems: "center", gap: theme.spacing.md }}>
        <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>{t("review.spawt_not_found")}</Text>
        <Pressable onPress={close} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.colors.brand.accent }}>{t("common.back")}</Text></Pressable>
      </View>
    </SafeAreaView>
  );

  const disabled = !ready || !ratings || submitting || addingPhoto || published.current;
  const titleStyle = { ...theme.typography.preset.h3, color: theme.colors.text.primary, marginBottom: theme.spacing.sm };
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg }}>
          <Text testID="review-place-name" style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary, marginBottom: theme.spacing.sm }}>{placeName ? t("review.title", { place_name: placeName }) : t("review.title_fallback")}</Text>
          <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary, marginBottom: theme.spacing.lg }}>{t("review.subtitle")}</Text>
          {!ready && !error ? <ActivityIndicator /> : null}
          {CRITERIA.map(criterion => (
            <View key={criterion} style={{ marginBottom: theme.spacing.md }}>
              <Text style={titleStyle}>{t(`review.${criterion}`)}</Text>
              <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
                {([1, 2, 3, 4, 5] as StarRating[]).map(n => (
                  <Pressable key={n} testID={`review-${criterion}-${n}`} disabled={!ready || submitting}
                    accessibilityRole="button" accessibilityState={{ selected: draft[criterion] === n }}
                    accessibilityLabel={t("review.rate_label", { criterion: t(`review.${criterion}`), count: n })}
                    onPress={() => setDraft(prev => ({ ...prev, [criterion]: n }))}
                    style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" }}>
                    <Stars value={draft[criterion] !== null && n <= draft[criterion]! ? 1 : 0} max={1} size="lg" />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          <Text testID="review-global-rating" style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary, marginBottom: theme.spacing.lg }}>{ratings ? t("review.global_rating", { rating: globalReviewRating(ratings).toFixed(1).replace(".", ",") }) : t("review.stars_hint")}</Text>
          <Text style={titleStyle}>{t("review.section_tags")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
            {REVIEW_TAGS.map(tag => <Chip key={tag} label={t(`review.tags.${tag}`)} selected={draft.tags.includes(tag)} variant={draft.tags.includes(tag) ? "gold" : "outline"} onPress={() => { if (!submitting) setDraft(prev => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(x => x !== tag) : [...prev.tags, tag] })); }} />)}
          </View>
          <Text style={titleStyle}>{t("review.section_text")}</Text>
          <TextInput testID="review-text" multiline maxLength={500} value={draft.text} editable={ready && !submitting}
            onChangeText={text => setDraft(prev => ({ ...prev, text }))} placeholder={t("review.text_placeholder")} placeholderTextColor={theme.colors.text.tertiary}
            style={{ ...theme.typography.preset.body, color: theme.colors.text.primary, minHeight: 112, padding: theme.spacing.base, borderWidth: 1, borderColor: theme.colors.border.subtle, borderRadius: theme.radius.md, textAlignVertical: "top" }} />
          <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.tertiary, textAlign: "right", marginBottom: theme.spacing.lg }}>{draft.text.length}/500</Text>
          <Text style={titleStyle}>{t("review.section_photos")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            {draft.photoUris.map((uri, idx) => (
              <View key={uri} style={{ width: 80 }}>
                <Image testID={`review-photo-${idx}`} source={{ uri }} style={{ width: 80, height: 80, borderRadius: theme.radius.md }} accessibilityLabel={t("place.review_photo_alt")} />
                <Pressable disabled={submitting} accessibilityRole="button" accessibilityLabel={t("review.photo_remove")} onPress={() => setDraft(prev => ({ ...prev, photoUris: prev.photoUris.filter((_, i) => i !== idx) }))} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...theme.typography.preset.caption, color: theme.colors.text.secondary }}>{t("review.photo_remove")}</Text></Pressable>
              </View>
            ))}
            {draft.photoUris.length < 3 ? <Pressable testID="review-photo-add" disabled={!ready || submitting || addingPhoto} onPress={() => void addPhoto()} accessibilityRole="button" accessibilityLabel={t("review.photo_add")} style={{ width: 80, minHeight: 80, borderWidth: 1, borderStyle: "dashed", borderColor: theme.colors.border.strong, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center" }}>{addingPhoto ? <ActivityIndicator /> : <Text style={{ ...theme.typography.preset.h1, color: theme.colors.text.secondary }}>+</Text>}</Pressable> : null}
          </View>
          {error ? <Text accessibilityRole="alert" testID="review-error" style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>{error}</Text> : null}
        </ScrollView>
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border.subtle, gap: theme.spacing.xs }}>
          <Pressable testID="review-submit" disabled={disabled} onPress={() => void submit()} accessibilityRole="button" accessibilityState={{ disabled, busy: submitting }} accessibilityLabel={t("review.cta_save")} style={({ pressed }) => ({ minHeight: 48, padding: theme.spacing.sm, borderRadius: theme.radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.accent, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 })}>
            {submitting ? <ActivityIndicator color={theme.colors.text.inverse} /> : <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.inverse, textAlign: "center" }}>{t("review.cta_save")}</Text>}
          </Pressable>
          <Pressable disabled={submitting} onPress={() => { track({ name: "review_abandoned", properties: { place_id: spawt.place_id, had_note: CRITERIA.some(c => draft[c] !== null) } }); close(); }} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}><Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary, textAlign: "center" }}>{t("review.cta_later")}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
