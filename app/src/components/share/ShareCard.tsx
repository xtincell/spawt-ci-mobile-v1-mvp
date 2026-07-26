// ShareCard — carte 9:16 partageable (SPAWT Wrapped, carte d'archétype).
// Noir profond + or (tokens gradient.night / brand.primary uniquement),
// visuel d'archétype réutilisé des assets embarqués du quiz « La Meute ».
// Le composant est PUR (aucun module natif) : la capture vit dans
// lib/share-card.ts — on lui passe la ref du View racine.

import { forwardRef } from "react";
import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../../theme/ThemeProvider";
import { gradient } from "../../theme/tokens";
import { Wordmark } from "../primitives/Wordmark";
import { ARCHETYPE_ASSETS } from "../../data/archetype-assets";
import { isArchetypeKey } from "../../lib/archetype-engine";

export interface ShareCardStat {
  label: string;
  value: string;
}

interface Props {
  /** Surligne du haut (ex. « SPAWT Wrapped 2026 »). */
  kicker: string;
  /** Gros titre or (ex. archétype, ou le chiffre-héro de l'année). */
  headline: string;
  /** Ligne d'appui sous le titre (optionnelle). */
  subline?: string | undefined;
  /** Statistiques listées (max ~4 pour rester lisible en 9:16). */
  stats?: readonly ShareCardStat[] | undefined;
  /** Visuel d'archétype embarqué si la clé est connue. */
  archetype?: string | null | undefined;
  /** Pied de carte (ex. mention Pionnier). */
  footer?: string | undefined;
  /** Largeur rendue (hauteur dérivée 16/9). */
  width?: number | undefined;
}

export const ShareCard = forwardRef<View, Props>(function ShareCard(
  { kicker, headline, subline, stats = [], archetype, footer, width = 270 },
  ref,
) {
  const theme = useTheme();
  const height = (width * 16) / 9;
  const asset =
    archetype && isArchetypeKey(archetype) ? ARCHETYPE_ASSETS[archetype] : null;

  return (
    <View
      ref={ref}
      collapsable={false}
      testID="share-card"
      style={{
        width,
        height,
        borderRadius: theme.radius.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.colors.brand.primary,
      }}
    >
      <LinearGradient
        colors={gradient.night}
        style={{
          flex: 1,
          padding: theme.spacing.lg,
          justifyContent: "space-between",
        }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.text.inverseSecondary,
            }}
          >
            {kicker}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.display,
              color: theme.colors.brand.primary,
            }}
          >
            {headline}
          </Text>
          {subline ? (
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.inverse,
              }}
            >
              {subline}
            </Text>
          ) : null}
        </View>

        {asset ? (
          <Image
            source={asset}
            resizeMode="contain"
            accessible={false}
            style={{
              width: "70%",
              aspectRatio: 1,
              alignSelf: "center",
            }}
          />
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: theme.spacing.base,
              }}
            >
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.inverseSecondary,
                  flexShrink: 1,
                }}
              >
                {stat.label}
              </Text>
              <Text
                style={{
                  ...theme.typography.preset.data,
                  color: theme.colors.text.inverse,
                }}
              >
                {stat.value}
              </Text>
            </View>
          ))}
          {footer ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.brand.primary,
              }}
            >
              {footer}
            </Text>
          ) : null}
          <View style={{ alignItems: "flex-start", marginTop: theme.spacing.xs }}>
            <Wordmark size={18} color={theme.colors.brand.primary} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
});
