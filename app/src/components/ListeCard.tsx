// Story 3.6 — variant compact de PlaceCard pour la liste favoris.
// Layout horizontal : vignette à gauche, contenu à droite + icon heart à droite.

import { Image, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { Ico } from "./primitives/Ico";
import { Stars } from "./primitives/Stars";
import { Chip } from "./primitives/Chip";
import { PlaceActivityPill } from "./PlaceActivityPill";
import type { PlaceWithAdn } from "../lib/data-source";
import type { PlaceActivityFlags } from "../lib/place-activity";

interface Props {
  place: PlaceWithAdn;
  onPress: () => void;
  /** Si fourni, affiche un bouton "retirer des favoris" à droite. */
  onUnsave?: () => void;
  /** Pastille « Promo » / « Événement » (0049/0050) — chargée par LOT côté
   *  feed (flag `evenements-promos`). Absente → carte strictement identique. */
  activity?: PlaceActivityFlags | undefined;
}

export function ListeCard({ place, onPress, onUnsave, activity }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const hasRating =
    Number.isFinite(place.rating_display) && place.rating_display > 0;
  const cuisineLabel = place.cuisine[0] ?? "";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={place.name}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.base,
        paddingVertical: theme.spacing.base,
        paddingHorizontal: theme.spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
        backgroundColor: theme.colors.surface.base,
      })}
    >
      {place.cover_photo_url ? (
        <Image
          source={{ uri: place.cover_photo_url }}
          style={{
            width: 60,
            height: 60,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface.subtle,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface.subtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ico name="pin" size={20} color={theme.colors.text.tertiary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={{ ...theme.typography.preset.h3, color: theme.colors.text.primary }}
          numberOfLines={1}
        >
          {place.name}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {place.location.neighborhood}
          {cuisineLabel ? ` · ${cuisineLabel}` : ""}
        </Text>
        <View
          style={{
            marginTop: theme.spacing.xs,
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
          }}
        >
          {hasRating ? (
            <Stars value={place.rating_display} />
          ) : (
            <Chip label={t("place.notRatedYet")} variant="default" />
          )}
          {/* Pastille discrète événements/promos — null si rien en cours. */}
          <PlaceActivityPill activity={activity} />
        </View>
      </View>
      {onUnsave ? (
        <Pressable
          onPress={onUnsave}
          accessibilityRole="button"
          accessibilityLabel={t("list.remove_from_saved_aria")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: theme.spacing.xs }}
        >
          <Ico name="heart" size={24} filled color={theme.colors.brand.primary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
