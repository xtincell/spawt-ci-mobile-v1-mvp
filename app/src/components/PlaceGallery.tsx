// Story 4.12 — AC #3 : galerie photos (≥ 3 slots) rendue depuis `gallery_urls`
// (TEXT[] déjà existant, place.ts:102). Si moins de 3 URLs → on complète avec
// des placeholders neutres (icône camera, jamais un placeholder « restaurant »
// générique — anti-pattern brand). La cover (hero) reste distincte de la galerie.
//
// Storage : les URLs viennent du bucket place-photos existant (migration 0013)
// ou d'un CDN seedé côté admin (Story 6.2/6.3). Aucune migration.

import { useState } from "react";
import { View, Text, Image, ScrollView, Modal, Pressable, type ImageSourcePropType } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { Ico } from "./primitives/Ico";

const MIN_SLOTS = 3;
const TILE = 120;

interface Props {
  urls: readonly string[];
  pictures?: readonly GalleryPicture[];
  /** Override du minimum de slots (tests + galerie des spawters : 0). */
  minSlots?: number;
  /** Titre de section override (défaut : t("place.gallery_title")). Permet la
      réutilisation dans l'onglet Média (R17) — présentation vs spawters. */
  title?: string;
}

export type GalleryPicture = {source: ImageSourcePropType; caption?: string};

export function PlaceGallery({ urls, pictures = [], minSlots = MIN_SLOTS, title }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [opened,setOpened] = useState<GalleryPicture | null>(null);
  const valid = [...pictures, ...urls.filter(u => typeof u === "string" && u.length > 0).map(uri => ({source:{uri}}))];
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
        {valid.map((picture, idx) => (
          <GalleryTile key={JSON.stringify(picture.source) + idx} picture={picture} onOpen={() => setOpened(picture)} />
        ))}
        {Array.from({ length: placeholders }).map((_, idx) => (
          <GalleryPlaceholder key={`placeholder-${idx}`} />
        ))}
      </ScrollView>
      {opened ? <Modal animationType="fade" onRequestClose={() => setOpened(null)}>
        <View accessibilityViewIsModal style={{flex:1,backgroundColor:theme.colors.surface.inverse,padding:theme.spacing.lg}}>
          <Pressable accessibilityRole="button" onPress={()=>setOpened(null)} style={{minHeight:48,alignItems:"flex-end",justifyContent:"center"}}><Text style={{...theme.typography.preset.body,color:theme.colors.text.inverse}}>{t("common.close")}</Text></Pressable>
          <Image source={opened.source} resizeMode="contain" style={{flex:1,width:"100%"}}/>
          {opened.caption ? <Text style={{...theme.typography.preset.body,color:theme.colors.text.inverse}}>{opened.caption}</Text> : null}
        </View>
      </Modal> : null}
    </View>
  );
}

function GalleryTile({picture, onOpen}: {picture: GalleryPicture; onOpen:()=>void}) {
  const {t}=useTranslation();
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  if (failed) return <GalleryPlaceholder />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={picture.caption || t("place.open_photo")} onPress={onOpen}>
    <Image
      source={picture.source}
      onError={() => setFailed(true)}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      style={{
        width: TILE,
        height: TILE,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.subtle,
      }}
    /></Pressable>
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
