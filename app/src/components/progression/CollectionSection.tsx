// Progression — section Collection : cartes collector par rareté, tap = flip
// recto/verso (même pattern Reanimated que SpawterCard : perspective +
// rotateY interpolé, backfaceVisibility hidden). Mémoire d'identité, pas un
// trophée — les cartes ne se comparent pas, elles se collectionnent.

import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { gradient } from "../../theme/tokens";
import { ARCHETYPE_ASSETS } from "../../data/archetype-assets";
import { isArchetypeKey } from "../../lib/archetype-engine";
import { groupCardsByRarity } from "../../lib/progression-engine";
import type { OwnedCard } from "../../types/progression";

const FLIP_DURATION_MS = 500;

interface Props {
  cards: readonly OwnedCard[];
}

export function CollectionSection({ cards }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const groups = groupCardsByRarity(cards);

  return (
    <View testID="progression-collection-section" style={{ gap: theme.spacing.base }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>
          {t("progression.collection_title")}
        </Text>
        <Text style={{ ...theme.typography.preset.data, color: theme.colors.text.tertiary }}>
          {t("progression.collection_count", { count: cards.length })}
        </Text>
      </View>

      {cards.length === 0 ? (
        <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
          {t("progression.collection_empty")}
        </Text>
      ) : (
        groups.map((group) => (
          <View key={group.rarity} style={{ gap: theme.spacing.sm }}>
            <Text
              style={{
                ...theme.typography.preset.caption,
                color: theme.colors.text.tertiary,
              }}
            >
              {t(`archetype.rarity.${group.rarity}`)}
            </Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.base }}
            >
              {group.cards.map((card) => (
                <CollectibleCardTile key={card.id} card={card} />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * Tuile carte — flip 3D recto (visuel + titre + rareté) / verso (texte verso
 * + provenance). Le visuel des cartes archétype réutilise les assets webp
 * embarqués (data/archetype-assets) ; autres kinds → fallback typographique.
 */
function CollectibleCardTile({ card }: { card: OwnedCard }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const flipProgress = useSharedValue(0);
  const [imageFailed, setImageFailed] = useState(false);

  const handleFlip = useCallback(() => {
    const target = flipProgress.value > 0.5 ? 0 : 1;
    flipProgress.value = withTiming(target, {
      duration: FLIP_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [flipProgress]);

  // Cleanup au unmount (même garde m2 que SpawterCard) : navigation rapide
  // mid-flip ne doit pas écrire sur une shared value démontée.
  useEffect(
    () => () => {
      cancelAnimation(flipProgress);
    },
    [flipProgress],
  );

  const rectoStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`;
    return {
      transform: [{ perspective: 1000 }, { rotateY }],
      opacity: flipProgress.value < 0.5 ? 1 : 0,
      backfaceVisibility: "hidden" as const,
    };
  });
  const versoStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg`;
    return {
      transform: [{ perspective: 1000 }, { rotateY }],
      opacity: flipProgress.value > 0.5 ? 1 : 0,
      backfaceVisibility: "hidden" as const,
    };
  });

  const asset =
    card.kind === "archetype" && isArchetypeKey(card.code) && !imageFailed
      ? ARCHETYPE_ASSETS[card.code]
      : null;

  return (
    <Pressable
      onPress={handleFlip}
      accessibilityRole="button"
      accessibilityLabel={t("progression.card_flip_aria", { title: card.title })}
      testID={`collectible-card-${card.code}`}
      style={{ width: "47%", aspectRatio: 0.7 }}
    >
      {/* Recto — visuel + titre + rareté. */}
      <Animated.View
        style={[
          {
            position: "absolute",
            inset: 0,
            borderRadius: theme.radius.lg,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: theme.colors.brand.primary,
          },
          rectoStyle,
        ]}
      >
        <LinearGradient colors={gradient.night} style={{ flex: 1 }}>
          {asset ? (
            <Image
              source={asset}
              resizeMode="cover"
              accessible={false}
              onError={() => setImageFailed(true)}
              style={{ width: "100%", flex: 1 }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text
                style={{
                  ...theme.typography.preset.h2,
                  color: theme.colors.brand.primary,
                  textAlign: "center",
                  paddingHorizontal: theme.spacing.sm,
                }}
              >
                {card.title}
              </Text>
            </View>
          )}
          <View style={{ padding: theme.spacing.sm }}>
            <Text
              numberOfLines={1}
              style={{ ...theme.typography.preset.h3, color: theme.colors.text.inverse }}
            >
              {card.title}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: theme.colors.brand.primary,
              }}
            >
              {t(`archetype.rarity.${card.rarity}`)}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Verso — texte verso + provenance + date. */}
      <Animated.View
        style={[
          {
            position: "absolute",
            inset: 0,
            borderRadius: theme.radius.lg,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: theme.colors.border.strong,
            backgroundColor: theme.colors.surface.subtle,
            padding: theme.spacing.base,
            justifyContent: "space-between",
          },
          versoStyle,
        ]}
      >
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.primary,
            fontStyle: "italic",
          }}
        >
          {card.verso_text ?? card.title}
        </Text>
        <View>
          <Text style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}>
            {t(`progression.card_source.${card.source}`)}
          </Text>
          <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.tertiary }}>
            {formatDateFr(card.obtained_at)}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** Date courte fr — tolérante aux strings invalides (fixtures/DB). */
function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
