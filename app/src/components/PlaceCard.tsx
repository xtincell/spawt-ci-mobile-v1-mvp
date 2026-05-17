// Carte d'un lieu dans le feed (PRD §3.1 Feature 3, §6.3 signaux).
// Re-dérivée Story 1.4 : consomme les primitives canoniques (MatchScore,
// Stars, Chip, Ico) — la signature publique reste stable pour les 3 callers
// (app/(tabs)/index.tsx, app/place/[id].tsx, app/(tabs)/profile.tsx).

import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Chip } from "./primitives/Chip";
import { Ico } from "./primitives/Ico";
import { MatchScore } from "./primitives/MatchScore";
import { Stars } from "./primitives/Stars";
import { useTheme } from "../theme/ThemeProvider";
import type { PlaceWithAdn } from "../lib/data-source";

interface Props {
  place: PlaceWithAdn;
  matchScore: number; // 50-99 (PRD §8.3)
  distanceKm: number;
  onPress: () => void;
}

const SIGNAL_LABELS: Record<string, string> = {
  coup_de_coeur: "❤️ Coup de Cœur",
  pepite_verifiee: "💎 Pépite vérifiée",
  institution: "👑 Institution",
  fidelite: "🔁 Fidélité",
  decouverte: "🌱 Découverte",
  table_diverse: "🌍 Table diverse",
  noctambule_verifie: "🌙 Noctambule",
};

const PRICE_TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "₣",
  2: "₣₣",
  3: "₣₣₣",
};

export function PlaceCard({ place, matchScore, distanceKm, onPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  // Defensive gate : un place non publié ne doit pas être rendu, même si
  // l'adapter serveur a un bug ou un deep-link bypasse le filtre RLS
  // (project-context : « ne pas se fier seul à la RLS serveur »).
  if (!place.is_published) return null;

  const [coverFailed, setCoverFailed] = useState(false);
  const adnReady = place.adn.confidence_score >= 0.3;
  const hasRating = Number.isFinite(place.rating_display) && place.rating_display > 0;
  const cuisineLabel = place.cuisine.length > 0 ? ` · ${place.cuisine.slice(0, 2).join(" · ")}` : "";
  const safeDistance =
    Number.isFinite(distanceKm) && distanceKm >= 0 ? `${distanceKm.toFixed(1)} km` : "—";
  const showCover = Boolean(place.cover_photo_url) && !coverFailed;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface.raised,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
        marginBottom: theme.spacing.base,
      })}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, score ${matchScore}%`}
    >
      {showCover ? (
        <Image
          source={{ uri: place.cover_photo_url ?? undefined }}
          style={{
            width: "100%",
            aspectRatio: 16 / 9,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
          }}
          resizeMode="cover"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <View
          style={{
            width: "100%",
            aspectRatio: 16 / 9,
            backgroundColor: theme.colors.surface.subtle,
            justifyContent: "center",
            alignItems: "center",
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
          }}
        >
          <Text style={{ color: theme.colors.text.tertiary, fontSize: 14 }}>—</Text>
        </View>
      )}
      <View style={{ padding: theme.spacing.base }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
          <Text
            style={{
              ...theme.typography.preset.h2,
              color: theme.colors.text.primary,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {place.name}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.secondary,
              marginBottom: theme.spacing.xs,
            }}
            numberOfLines={1}
          >
            {place.location.neighborhood}{cuisineLabel}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: theme.spacing.sm,
              marginTop: theme.spacing.xs,
              alignItems: "center",
            }}
          >
            <MatchScore value={matchScore} />
            {hasRating ? (
              <Stars value={place.rating_display} />
            ) : (
              <Chip label={t("place.notRatedYet")} variant="default" />
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ico name="walk" size={14} color={theme.colors.text.tertiary} />
              <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.tertiary }}>
                {safeDistance}
              </Text>
            </View>
            <Chip label={PRICE_TIER_LABELS[place.price.tier]} variant="default" />
          </View>
        </View>
      </View>

      {place.signals.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.spacing.xs,
            marginTop: theme.spacing.sm,
          }}
        >
          {place.signals.map((s) => (
            <Chip key={s} label={SIGNAL_LABELS[s] ?? s} variant="default" />
          ))}
        </View>
      )}

      {!adnReady && (
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.tertiary,
            marginTop: theme.spacing.sm,
            fontStyle: "italic",
          }}
        >
          ADN en construction
        </Text>
      )}
      </View>
    </Pressable>
  );
}
