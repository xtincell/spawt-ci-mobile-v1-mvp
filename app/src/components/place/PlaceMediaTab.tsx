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
import { ActivityIndicator, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { EmptyState } from "../EmptyState";
import { PlaceGallery } from "../PlaceGallery";
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
  | { kind: "loaded"; photos: string[] };

export function PlaceMediaTab({ placeId, galleryUrls, fetcher }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<FetchState>({ kind: "loading" });

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
        // Erreur ⇒ même UX que « aucune photo spawter » (pas d'écran d'erreur
        // dédié pour une section secondaire de la fiche).
        if (cancelled) return;
        setState({ kind: "loaded", photos: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [placeId, fetcher]);

  const presentation = galleryUrls
    .filter((u) => typeof u === "string" && u.length > 0)
    .slice(0, PRESENTATION_MAX);

  const spawterPhotos = state.kind === "loaded" ? state.photos : [];
  const isEmpty =
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
      {presentation.length > 0 ? <PlaceGallery urls={presentation} /> : null}

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
      ) : spawterPhotos.length > 0 ? (
        <PlaceGallery
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
