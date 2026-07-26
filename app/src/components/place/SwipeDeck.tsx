// Mode Rapide — SwipeDeck : pile de cartes swipeables (post-MVP #1).
//
// Gestes : swipe droite = « Je le garde » (like), swipe gauche = « Passe ».
// Micro-feedback sobre : translation + légère rotation (reanimated), tag
// « Je le garde » / « Passe » qui s'opacifie avec le geste, carte suivante
// qui remonte en échelle. Boutons fallback accessibles (✕ / ♥) sous la
// carte — même chemin de décision que le geste (a11y + web sans pan).
//
// Composant PRÉSENTATIONNEL : il ne connaît ni le store ni analytics — le
// caller (app/rapide.tsx) branche onLike/onPass sur toggleSaved + track +
// applySwipeSignal. La carte réutilise les primitives canoniques
// (MatchScore, Stars, Ico) et le langage visuel d'UneCard (photo hero,
// scrim bas, titre Klinsman).
//
// Fin de deck : état vide voix du Chat (CatMark via EmptyState) + CTA
// retour feed. Deck vide dès l'ouverture : état distinct (rien à proposer).

import { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { EmptyState } from "../EmptyState";
import { Ico } from "../primitives/Ico";
import { MatchScore } from "../primitives/MatchScore";
import { Stars } from "../primitives/Stars";
import type { PlaceWithScore } from "../../lib/matching";
import type { SwipeDirection } from "../../lib/rapide-signals";

/** Fraction de la largeur d'écran au-delà de laquelle le swipe est commis. */
const COMMIT_RATIO = 0.32;
/** Vitesse (px/s) qui commet le swipe même sous le seuil de distance. */
const COMMIT_VELOCITY = 900;

interface Props {
  /** Deck FIGÉ pour la session — construit par buildRapideDeck côté écran. */
  deck: readonly PlaceWithScore[];
  /** Swipe droite / bouton ♥ — le caller sauvegarde + track + signal Palais. */
  onLike: (item: PlaceWithScore, deckPosition: number) => void;
  /** Swipe gauche / bouton ✕ — le caller track + signal Palais négatif. */
  onPass: (item: PlaceWithScore, deckPosition: number) => void;
  /** Tap sur la carte → fiche lieu. */
  onOpenPlace: (item: PlaceWithScore) => void;
  /** Dernière carte swipée (appelé 1×). */
  onDeckEnded: () => void;
  /** CTA des états vides → retour feed. */
  onBackToFeed: () => void;
}

export function SwipeDeck({
  deck,
  onLike,
  onPass,
  onOpenPlace,
  onDeckEnded,
  onBackToFeed,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const translateX = useSharedValue(0);
  const endedRef = useRef(false);

  const current = deck[index];
  const next = deck[index + 1];

  // rapide_deck_ended — 1× quand la dernière carte part (pas sur deck vide
  // initial : c'est un état « rien à proposer », pas une fin de session).
  useEffect(() => {
    if (deck.length > 0 && index >= deck.length && !endedRef.current) {
      endedRef.current = true;
      onDeckEnded();
    }
  }, [index, deck.length, onDeckEnded]);

  const commitDecision = (direction: SwipeDirection) => {
    const item = deck[index];
    if (!item) return;
    translateX.value = 0;
    setIndex((i) => i + 1);
    if (direction === "like") {
      onLike(item, index);
    } else {
      onPass(item, index);
    }
  };

  const pan = Gesture.Pan()
    // Laisse les taps (fiche lieu) et le scroll vertical passer.
    .activeOffsetX([-16, 16])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const shouldCommit =
        Math.abs(e.translationX) > width * COMMIT_RATIO ||
        Math.abs(e.velocityX) > COMMIT_VELOCITY;
      if (shouldCommit) {
        const direction: SwipeDirection = e.translationX > 0 ? "like" : "pass";
        // Sortie animée puis décision — sobre (180 ms, pas de rebond).
        translateX.value = withTiming(
          Math.sign(e.translationX) * width * 1.4,
          { duration: 180 },
          () => {
            runOnJS(commitDecision)(direction);
          },
        );
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const topCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width, 0, width],
      [-10, 0, 10],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateX: translateX.value }, { rotate: `${rotate}deg` }],
    };
  });

  const keepTagStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [24, width * COMMIT_RATIO],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const passTagStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-width * COMMIT_RATIO, -24],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const nextCardStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / width, 1);
    return { transform: [{ scale: 0.94 + progress * 0.06 }] };
  });

  // ── États vides ─────────────────────────────────────
  if (deck.length === 0) {
    return (
      <EmptyState
        title={t("rapide.empty_title")}
        body={t("rapide.empty_body")}
        cta={{ label: t("rapide.empty_cta"), onPress: onBackToFeed }}
      />
    );
  }

  if (!current) {
    return (
      <EmptyState
        title={t("rapide.deck_end_title")}
        body={t("rapide.deck_end_body")}
        cta={{ label: t("rapide.deck_end_cta"), onPress: onBackToFeed }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Pile : carte suivante derrière (profondeur), carte courante devant. */}
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg }}>
        {next ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: theme.spacing.sm,
                left: theme.spacing.lg,
                right: theme.spacing.lg,
                bottom: theme.spacing.sm,
              },
              nextCardStyle,
            ]}
          >
            <SwipeCard item={next} />
          </Animated.View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1, marginVertical: theme.spacing.sm }, topCardStyle]}>
            <Pressable
              onPress={() => onOpenPlace(current)}
              accessibilityRole="button"
              accessibilityLabel={t("rapide.card_open_aria", {
                name: current.place.name,
              })}
              style={{ flex: 1 }}
            >
              <SwipeCard item={current} />
            </Pressable>

            {/* Tags de décision — opacité pilotée par le geste. */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: theme.spacing.lg,
                  left: theme.spacing.lg,
                  backgroundColor: theme.colors.brand.accent,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing.base,
                  paddingVertical: theme.spacing.xs,
                },
                keepTagStyle,
              ]}
            >
              <Text
                style={{
                  ...theme.typography.preset.overline,
                  color: theme.colors.text.inverse,
                }}
              >
                {t("rapide.keep_label")}
              </Text>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: theme.spacing.lg,
                  right: theme.spacing.lg,
                  backgroundColor: theme.colors.surface.inverse,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing.base,
                  paddingVertical: theme.spacing.xs,
                },
                passTagStyle,
              ]}
            >
              <Text
                style={{
                  ...theme.typography.preset.overline,
                  color: theme.colors.text.inverse,
                }}
              >
                {t("rapide.pass_label")}
              </Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Boutons fallback accessibles — même décision que le geste. */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: theme.spacing["2xl"],
          paddingVertical: theme.spacing.lg,
        }}
      >
        <DecisionButton
          icon="close"
          label={t("rapide.pass_label")}
          accessibilityLabel={t("rapide.pass_aria")}
          onPress={() => commitDecision("pass")}
        />
        <DecisionButton
          icon="heart"
          filled
          label={t("rapide.keep_label")}
          accessibilityLabel={t("rapide.keep_aria")}
          onPress={() => commitDecision("like")}
        />
      </View>
    </View>
  );
}

/** Carte d'un lieu — photo hero + scrim bas, langage visuel d'UneCard. */
function SwipeCard({ item }: { item: PlaceWithScore }) {
  const theme = useTheme();
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUrl = item.place.cover_photo_url ?? "";
  const hasCover = coverUrl.length > 0 && !coverFailed;
  const cuisine0 = item.place.cuisine[0] ?? "";
  const hasRating =
    Number.isFinite(item.adn.weighted_rating) && item.adn.weighted_rating > 0;
  const safeDistance =
    Number.isFinite(item.distance_km) && item.distance_km >= 0
      ? `${item.distance_km.toFixed(1)} km`
      : "—";

  return (
    <View
      style={{
        flex: 1,
        borderRadius: theme.radius.card,
        overflow: "hidden",
        backgroundColor: theme.colors.surface.subtle,
      }}
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
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.surface.subtle,
          }}
        >
          <Ico name="pin" size={56} color={theme.colors.text.tertiary} />
        </View>
      )}

      {/* Scrim bas — mêmes garanties de contraste qu'UneCard. */}
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
        <Text
          style={{
            ...theme.typography.preset.h2,
            color: theme.colors.text.inverse,
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {item.place.name}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.inverseSecondary,
            marginBottom: theme.spacing.sm,
          }}
          numberOfLines={1}
        >
          {item.place.location.neighborhood}
          {cuisine0 ? ` · ${cuisine0}` : ""}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: theme.spacing.sm,
          }}
        >
          <MatchScore value={item.match_score} />
          {hasRating ? <Stars value={item.adn.weighted_rating} /> : null}
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Ico name="walk" size={14} color={theme.colors.text.inverseSecondary} />
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.inverseSecondary,
              }}
            >
              {safeDistance}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Bouton rond de décision (✕ / ♥) — cible 56 px, label caption dessous. */
function DecisionButton({
  icon,
  label,
  accessibilityLabel,
  onPress,
  filled = false,
}: {
  icon: "close" | "heart";
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  filled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => ({
        alignItems: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radius.full,
          borderWidth: 1.5,
          borderColor:
            icon === "heart"
              ? theme.colors.brand.primary
              : theme.colors.border.strong,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.surface.raised,
        }}
      >
        <Ico
          name={icon}
          size={24}
          filled={filled}
          color={
            icon === "heart"
              ? theme.colors.brand.primary
              : theme.colors.text.primary
          }
        />
      </View>
      <Text
        style={{
          ...theme.typography.preset.caption,
          color: theme.colors.text.tertiary,
          marginTop: theme.spacing.xs,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
