// Story 5.3 — Carte spawter flip 3D (PRD §3.1 FR-008 + §20.1).
// Recto gr-night (identité) ↔ verso bg-warm (axes du Palais en barres).
// Reanimated 4 useSharedValue + interpolate rotateY (UI thread, 60 FPS).
// Pas de gamification — identité avant utilité.
//
// R8 (MAJ consolidée 07/2026, P0) — le graphe RADAR est retiré du parcours
// utilisateur (réservé exploitation interne) : le verso rend les axes en
// barres horizontales (AxisBar) pour tous les tiers.

import { useCallback, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
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

import { useTheme, type Theme } from "../theme/ThemeProvider";
import { gradient } from "../theme/tokens";
import { STADE_DESCRIPTORS } from "../types/stade";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import { track } from "../lib/analytics";

interface Props {
  spawter: Spawter;
  palais: UserPalais;
  /** Clé i18n du titre affiché (Story 5.2). Fallback = titre du stade actuel. */
  displayedTitleKey: string;
  /** Gate axes Gold (V1 = false par défaut, hook prêt pour V1.5 Gold). */
  isGold: boolean;
  /** Q3 — « Spawts » = nombre d'ÉTABLISSEMENTS spawtés (lieux distincts). */
  uniqueSpots: number;
  /** Q3 — « Favoris » = nombre de lieux sauvegardés (saved_places). */
  savedCount: number;
  reviewsCount: number;
}

const FLIP_DURATION_MS = 600;

export function SpawterCard({
  spawter,
  palais,
  displayedTitleKey,
  isGold,
  uniqueSpots,
  savedCount,
  reviewsCount,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const flipProgress = useSharedValue(0);

  const handleFlip = useCallback(() => {
    const target = flipProgress.value > 0.5 ? 0 : 1;
    flipProgress.value = withTiming(target, {
      duration: FLIP_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
    });
    track({
      name: "spawter_card_flipped",
      properties: { to: target === 0 ? "recto" : "verso" },
    });
  }, [flipProgress]);

  // CR finding m2 — cleanup au unmount pour éviter "writing to shared value of
  // unmounted component" si navigation rapide pendant mid-flip.
  useEffect(
    () => () => {
      cancelAnimation(flipProgress);
    },
    [flipProgress],
  );

  // CR finding M5 — `backfaceVisibility: 'hidden'` n'agit qu'avec un contexte 3D :
  // `perspective` doit être posé en tête du `transform` pour que la rotation Y
  // donne un effet de tranche au lieu d'un flip-flop binaire à 0.5.
  // Le `perspective: 1000` est une valeur fréquemment utilisée pour les cards
  // 3D — cohérent avec le ratio aspectRatio 0.7 du Pressable parent.
  const rectoStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`;
    const opacity = flipProgress.value < 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: 1000 }, { rotateY }],
      opacity,
      backfaceVisibility: "hidden",
    };
  });
  const versoStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg`;
    const opacity = flipProgress.value > 0.5 ? 1 : 0;
    return {
      transform: [{ perspective: 1000 }, { rotateY }],
      opacity,
      backfaceVisibility: "hidden",
    };
  });

  const adnReady = palais.confidence_score >= 0.3;
  const stadeDesc = STADE_DESCRIPTORS[spawter.stade];

  return (
    <Pressable
      onPress={handleFlip}
      accessibilityRole="button"
      accessibilityLabel={t("profile.card_flip_aria")}
      style={{ aspectRatio: 0.7 }}
    >
      <Animated.View
        style={[
          { position: "absolute", inset: 0, borderRadius: theme.radius.card, overflow: "hidden" },
          rectoStyle,
        ]}
      >
        <LinearGradient
          colors={gradient.night}
          style={{ flex: 1, padding: theme.spacing.lg, justifyContent: "space-between" }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...theme.typography.preset.overline, color: theme.colors.text.inverseSecondary }}>
              {t("profile.card_id_prefix")} #{spawter.id.slice(0, 6).toUpperCase()}
            </Text>
            <Text style={{ ...theme.typography.preset.overline, color: theme.colors.brand.primary }}>
              {t(`stade.${spawter.stade}`)}
            </Text>
          </View>

          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: theme.colors.brand.primary,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: theme.spacing.base,
              }}
            >
              <Text
                style={{
                  ...theme.typography.preset.display,
                  color: theme.colors.text.onBrand,
                }}
              >
                {/* CR finding m1 — trim + fallback explicite "S" pour bloquer
                    le cas display_name vide (DB default ""), sinon avatar lettre vide. */}
                {(spawter.display_name?.trim().charAt(0) || "S").toUpperCase()}
              </Text>
            </View>
            <Text
              style={{
                ...theme.typography.preset.h1,
                color: theme.colors.text.inverse,
                textAlign: "center",
              }}
            >
              {spawter.display_name}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.caption,
                color: theme.colors.brand.primary,
                marginTop: theme.spacing.xs,
              }}
            >
              {t(displayedTitleKey)}
            </Text>
          </View>

          {/* Q3 — compteurs clarifiés : « Spawts » = établissements spawtés,
              « Favoris » = lieux sauvegardés. Fini l'ambigu « Spawts uniques ». */}
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <StatBlock label={t("profile.stat_spawts")} value={uniqueSpots} theme={theme} />
            <StatBlock label={t("profile.stat_favoris")} value={savedCount} theme={theme} />
            <StatBlock label={t("profile.stat_avis")} value={reviewsCount} theme={theme} />
          </View>

          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.inverseSecondary,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            {stadeDesc.behavior}
          </Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={[
          { position: "absolute", inset: 0, borderRadius: theme.radius.card, overflow: "hidden" },
          versoStyle,
        ]}
      >
        <View
          style={{
            flex: 1,
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.surface.subtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PalaisAxesGated
            palais={palais}
            visibleAxesCount={isGold ? 5 : 2}
            underConstruction={!adnReady}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function StatBlock({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: Theme;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ ...theme.typography.preset.display, color: theme.colors.brand.primary }}>
        {value}
      </Text>
      <Text style={{ ...theme.typography.preset.overline, color: theme.colors.text.inverseSecondary }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * CR finding D2 + R8 — Gate Gold sur le Palais (PRD §3.1 FR-008), rendu 100 %
 * en barres horizontales (le graphe radar est réservé à l'exploitation
 * interne, retour produit R8) :
 * - En construction (confidence < 0.3) : 2 axes de base estompés + mention.
 * - Free : 2 axes fondamentaux + teaser Gold.
 * - Gold : les 5 axes en barres.
 */
function PalaisAxesGated({
  palais,
  visibleAxesCount,
  underConstruction,
}: {
  palais: UserPalais;
  visibleAxesCount: 2 | 5;
  underConstruction: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const baseAxes = [
    { value: palais.axe_racines_horizons, negLabel: t("axis.racines"), posLabel: t("axis.horizons") },
    { value: palais.axe_taniere_nomade, negLabel: t("axis.taniere"), posLabel: t("axis.nomade") },
  ];
  const goldAxes = [
    { value: palais.axe_exigeant_enthousiaste, negLabel: t("axis.exigeant"), posLabel: t("axis.enthousiaste") },
    { value: palais.axe_foule_secret, negLabel: t("axis.foule"), posLabel: t("axis.secret") },
    { value: palais.axe_maquis_table, negLabel: t("axis.maquis"), posLabel: t("axis.table") },
  ];
  const axes = visibleAxesCount === 5 ? [...baseAxes, ...goldAxes] : baseAxes;

  return (
    <View
      style={{
        width: "100%",
        paddingHorizontal: theme.spacing.lg,
        opacity: underConstruction ? 0.45 : 1,
      }}
    >
      {axes.map((axis, i) => (
        <View key={axis.negLabel} style={{ marginTop: i === 0 ? 0 : theme.spacing.lg }}>
          <AxisBar value={axis.value} negLabel={axis.negLabel} posLabel={axis.posLabel} />
        </View>
      ))}
      {underConstruction ? (
        <Text
          style={{
            marginTop: theme.spacing.xl,
            ...theme.typography.preset.small,
            color: theme.colors.text.tertiary,
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {t("palais.underConstruction")}
        </Text>
      ) : null}
      {!underConstruction && visibleAxesCount === 2 ? (
        <Text
          style={{
            marginTop: theme.spacing.xl,
            ...theme.typography.preset.small,
            color: theme.colors.text.tertiary,
            textAlign: "center",
            fontStyle: "italic",
            opacity: 0.8,
          }}
        >
          {t("profile.palais_gold_teaser")}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Barre horizontale -1..+1 avec label des deux pôles et marqueur central.
 * Honnête remplacement du radar quand seul 1 axe est exposé (gate free V1).
 */
function AxisBar({
  value,
  negLabel,
  posLabel,
}: {
  value: number;
  negLabel: string;
  posLabel: string;
}) {
  const theme = useTheme();
  // value ∈ [-1, +1] → position en % depuis la gauche (0% = -1, 100% = +1).
  const clamped = Math.max(-1, Math.min(1, value));
  const positionPercent = ((clamped + 1) / 2) * 100;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text
          style={{
            ...theme.typography.preset.overline,
            color: theme.colors.text.secondary,
          }}
        >
          {negLabel}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.overline,
            color: theme.colors.text.secondary,
          }}
        >
          {posLabel}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: theme.colors.border.subtle,
          borderRadius: 3,
          position: "relative",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: "50%",
            top: -2,
            width: 1,
            height: 10,
            backgroundColor: theme.colors.text.tertiary,
            opacity: 0.5,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: `${positionPercent}%`,
            top: -4,
            marginLeft: -7,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: theme.colors.brand.primary,
          }}
        />
      </View>
    </View>
  );
}
