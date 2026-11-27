// Refonte fiche lieu (R17 / Q1) — onglet Média.
//
// Deux sections dans cet ordre :
//   1. Photos de présentation du lieu — jusqu'à 3, depuis `gallery_urls`
//      (optionnelles). Rendues via <PlaceGallery /> (slots + placeholders).
//   2. « Galerie des spawters » — photos des spawts de ce lieu (champ
//      `photos TEXT[]` de spawt_checkin, migration 0011), via
//      `listPlacePhotosFromSpawts` (fonctionne en mode démo ET supabase).
//
// État vide élégant (EmptyState « le chat tousse ») si aucune photo du tout.

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { EmptyState } from "../EmptyState";
import editorial from "../../data/le-cha-review.json";
import { PlaceGallery, type GalleryPicture } from "../PlaceGallery";
import { listPlacePhotosFromSpawts } from "../../lib/data-source";

/** Q1 — cap des photos de présentation sur la fiche. */
const PRESENTATION_MAX = 3;

interface Props {
  placeId: string;
  galleryUrls: readonly string[];
  /** Injection pour tests — bypass le data-source réel. */
  fetcher?: (placeId: string) => Promise<string[]>;
}

type FetchState =
  | { kind: "loading" }
  | { kind: "loaded"; photos: string[] }
  | { kind: "error" };

export function PlaceMediaTab({ placeId, galleryUrls, fetcher }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setShowAll(false), [placeId]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    const fetchPhotos = fetcher ?? listPlacePhotosFromSpawts;
    void fetchPhotos(placeId)
      .then((photos) => {
        if (cancelled) return;
        setState({ kind: "loaded", photos });
      })
      .catch((err: unknown) => {
        if (__DEV__) console.warn("[PlaceMediaTab] fetch failed", err);
        if (cancelled) return;
        setState({kind: "error"});
      });
    return () => {
      cancelled = true;
    };
  }, [placeId, fetcher, attempt]);

  const presentation = galleryUrls
    .filter((u) => typeof u === "string" && u.length > 0);

  const spawterPhotos = state.kind === "loaded" ? state.photos : [];
  const leCha = placeId === editorial.placeId;
  const official: GalleryPicture[] = leCha ? [
    {source:require("../../../assets/editorial/le-cha-officiel-corn-dog.webp"), caption:t("place.lecha_corn_dog")},
    {source:require("../../../assets/editorial/le-cha-officiel-corn-dogs-a-partager.webp"), caption:t("place.lecha_corn_dogs")},
  ] : [];
  const members: GalleryPicture[] = leCha ? [{source:require("../../../assets/editorial/le-cha.jpg"),caption:editorial.author+" · "+editorial.photoAlt}] : [];
  const isEmpty = !leCha &&
    state.kind === "loaded" &&
    presentation.length === 0 &&
    spawterPhotos.length === 0;

  if (isEmpty) {
    return (
      <View style={{ paddingVertical: theme.spacing.base }}>
        <EmptyState
          icon="camera"
          title={t("place.media_empty_title")}
          body={t("place.media_empty_body")}
        />
      </View>
    );
  }

  return (
    <View>
      {/* 1. Photos de présentation (jusqu'à 3, slots complétés en placeholders). */}
      {presentation.length || official.length ? <PlaceGallery title={t("place.official_photos")} pictures={official} urls={showAll ? presentation : presentation.slice(0, Math.max(0,PRESENTATION_MAX-official.length))} minSlots={0}/> : null}
      {presentation.length + official.length > PRESENTATION_MAX ? <Pressable testID="toggle-official-photos" accessibilityRole="button" accessibilityState={{expanded: showAll}}
        onPress={() => setShowAll(v => !v)} style={{minHeight: 44, justifyContent: "center"}}>
        <Text style={{...theme.typography.preset.small, color: theme.colors.brand.accent}}>{t(showAll ? "place.fewer_photos" : "place.all_photos", {count: presentation.length + official.length})}</Text>
      </Pressable> : null}

      {/* 2. Galerie des spawters. */}
      {state.kind === "loading" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.base,
          }}
        >
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      ) : state.kind === "error" ? <Pressable accessibilityRole="button" onPress={() => setAttempt(n => n + 1)}
        style={{minHeight: 48, justifyContent: "center"}}><Text style={{...theme.typography.preset.small, color: theme.colors.brand.accent}}>{t("place.retry_photos")}</Text></Pressable>
      : spawterPhotos.length > 0 || members.length > 0 ? (
        <PlaceGallery
          pictures={members}
          urls={spawterPhotos}
          minSlots={0}
          title={t("place.media_spawters_title")}
        />
      ) : (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Text
            style={{
              ...theme.typography.preset.h3,
              color: theme.colors.text.primary,
              marginBottom: theme.spacing.sm,
            }}
          >
            {t("place.media_spawters_title")}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.secondary,
              fontStyle: "italic",
            }}
          >
            {t("place.media_spawters_empty")}
          </Text>
        </View>
      )}
    </View>
  );
}
