// Story 3.3c — UneCard : carte éditoriale grande taille pour le top 3 du feed.
// UX spec §1287 — photo hero, kicker or, titre Klinsman, byline, médaille.

import { useState } from "react";
import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { Ico } from "./primitives/Ico";
import type { PlaceWithScore } from "../lib/matching";

interface Props {
  une: PlaceWithScore;
  onPress: () => void;
  /**
   * Affiche le pourcentage de match dans le kicker. Doit être passé à `false`
   * tant que `palais.confidence_score < 0.3` (project-context.md invariant —
   * un Palais "En construction" produit un score cosine près de 0.5 sur des
   * axes neutres, ce qui afficherait 75% trompeur).
   */
  showMatchScore?: boolean;
}

// Clé i18n par signal premium pour le kicker (overline). Les clés vivent dans
// `i18n/fr.json` sous `list.selection_signal_*` — voir Story 3.3c.
const KICKER_I18N_KEY: Record<string, string> = {
  coup_de_coeur: "list.selection_signal_coup_de_coeur",
  pepite_verifiee: "list.selection_signal_pepite_verifiee",
  institution: "list.selection_signal_institution",
  fidelite: "list.selection_signal_fidelite",
  decouverte: "list.selection_signal_decouverte",
  table_diverse: "list.selection_signal_table_diverse",
  noctambule_verifie: "list.selection_signal_noctambule_verifie",
};

const PREMIUM_SIGNALS = new Set(["pepite_verifiee", "coup_de_coeur"]);

export function UneCard({ une, onPress, showMatchScore = true }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [coverFailed, setCoverFailed] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 48;
  // hasCover doit tenir compte de la string vide : Zod accepte `""` côté DB,
  // et `Image source={uri:""}` peut déclencher onError → setCoverFailed → loop.
  const coverUrl = une.place.cover_photo_url ?? "";
  const hasCover = coverUrl.length > 0 && !coverFailed;
  const kickerSignal = une.place.signals[0];
  const cuisine0 = une.place.cuisine[0] ?? "";
  const kickerLabel = kickerSignal
    ? t(KICKER_I18N_KEY[kickerSignal] ?? "", {
        defaultValue: kickerSignal.toUpperCase(),
      }).toUpperCase()
    : cuisine0.toUpperCase();
  const hasPremiumMedal = une.place.signals.some((s) => PREMIUM_SIGNALS.has(s));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("place.card_aria_label", {
        name: une.place.name,
        score: une.match_score,
      })}
      style={({ pressed }) => ({
        width: cardWidth,
        height: 240,
        borderRadius: theme.radius.card,
        overflow: "hidden",
        backgroundColor: theme.colors.surface.subtle,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {hasCover ? (
        <Image
          source={{ uri: coverUrl }}
          onError={() => setCoverFailed(true)}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.surface.subtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ico name="pin" size={48} color={theme.colors.text.tertiary} />
        </View>
      )}

      {/* Médaille premium top-right */}
      {hasPremiumMedal ? (
        <View
          style={{
            position: "absolute",
            top: theme.spacing.base,
            right: theme.spacing.base,
            backgroundColor: theme.colors.brand.primary,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 4,
            borderRadius: theme.radius.full,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.text.onBrand,
            }}
          >
            {t("list.selection_badge")}
          </Text>
        </View>
      ) : null}

      {/* Overlay bas — scrim sombre (theme.colors.overlay.scrim) pour
          garantir le contraste du kicker Or sur tout fond, y compris le
          fallback sans photo (sinon le kicker brand.primary sur surface
          subtle devient illisible). */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: theme.spacing.lg,
          backgroundColor: theme.colors.overlay.scrim,
        }}
      >
        {kickerLabel.length > 0 || showMatchScore ? (
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.brand.primary,
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {kickerLabel}
            {kickerLabel.length > 0 && showMatchScore ? " · " : ""}
            {showMatchScore ? `${une.match_score}% MATCH` : ""}
          </Text>
        ) : null}
        <Text
          style={{
            ...theme.typography.preset.h2,
            color: theme.colors.text.inverse,
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {une.place.name}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.inverseSecondary,
          }}
          numberOfLines={1}
        >
          {une.place.location.neighborhood}
          {cuisine0 ? ` · ${cuisine0}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}
