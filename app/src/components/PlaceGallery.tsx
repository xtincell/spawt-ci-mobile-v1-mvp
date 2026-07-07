// Story 4.12 — AC #3 : galerie photos (≥ 3 slots) rendue depuis `gallery_urls`
// (TEXT[] déjà existant, place.ts:102). Si moins de 3 URLs → on complète avec
// des placeholders neutres (icône camera, jamais un placeholder « restaurant »
// générique — anti-pattern brand). La cover (hero) reste distincte de la galerie.
//
// Storage : les URLs viennent du bucket place-photos existant (migration 0013)
// ou d'un CDN seedé côté admin (Story 6.2/6.3). Aucune migration.

import { useState } from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { Ico } from "./primitives/Ico";

const MIN_SLOTS = 3;
const TILE = 120;

interface Props {
  urls: readonly string[];
  /** Override du minimum de slots (tests + galerie des spawters : 0). */
  minSlots?: number;
  /** Titre de section override (défaut : t("place.gallery_title")). Permet la
      réutilisation dans l'onglet Média (R17) — présentation vs spawters. */
  title?: string;
}

export function PlaceGallery({ urls, minSlots = MIN_SLOTS, title }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const valid = urls.filter((u) => typeof u === "string" && u.length > 0);
  const placeholders = Math.max(0, minSlots - valid.length);

  return (
    <View style={{ marginTop: theme.spacing.lg }}>
      <Text
        style={{
          ...theme.typography.preset.h3,
          color: theme.colors.text.primary,
          marginBottom: theme.spacing.sm,
        }}
      >
        {title ?? t("place.gallery_title")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm }}
      >
        {valid.map((url, idx) => (
          <GalleryTile key={`photo-${idx}`} url={url} />
        ))}
        {Array.from({ length: placeholders }).map((_, idx) => (
          <GalleryPlaceholder key={`placeholder-${idx}`} />
        ))}
      </ScrollView>
    </View>
  );
}

function GalleryTile({ url }: { url: string }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  if (failed) return <GalleryPlaceholder />;
  return (
    <Image
      source={{ uri: url }}
      onError={() => setFailed(true)}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      style={{
        width: TILE,
        height: TILE,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.subtle,
      }}
    />
  );
}

function GalleryPlaceholder() {
  const theme = useTheme();
  return (
    <View
      testID="gallery-placeholder"
      style={{
        width: TILE,
        height: TILE,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.subtle,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ico name="camera" size={28} color={theme.colors.text.tertiary} />
    </View>
  );
}
