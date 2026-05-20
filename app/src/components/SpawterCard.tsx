// Story 5.3 — Carte spawter flip 3D (PRD §3.1 FR-008 + §20.1).
// Recto gr-night (identité) ↔ verso bg-warm (Palais radar 5 axes).
// Reanimated 4 useSharedValue + interpolate rotateY (UI thread, 60 FPS).
// Pas de gamification — identité avant utilité.

import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useTheme, type Theme } from "../theme/ThemeProvider";
import { gradient } from "../theme/tokens";
import { AxisRadar } from "./AxisRadar";
import { STADE_DESCRIPTORS } from "../types/stade";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import { track } from "../lib/analytics";

interface Props {
  spawter: Spawter;
  palais: UserPalais;
  /** Clé i18n du titre affiché (Story 5.2). Fallback = titre du stade actuel. */
  displayedTitleKey: string;
  /** Gate radar (V1 = false par défaut, hook prêt pour V1.5 Gold). */
  isGold: boolean;
  totalSpawts: number;
  uniqueSpots: number;
  reviewsCount: number;
}

const FLIP_DURATION_MS = 600;

export function SpawterCard({
  spawter,
  palais,
  displayedTitleKey,
  isGold,
  totalSpawts,
  uniqueSpots,
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

  const rectoStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`;
    const opacity = flipProgress.value < 0.5 ? 1 : 0;
    return { transform: [{ rotateY }], opacity, backfaceVisibility: "hidden" };
  });
  const versoStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg`;
    const opacity = flipProgress.value > 0.5 ? 1 : 0;
    return { transform: [{ rotateY }], opacity, backfaceVisibility: "hidden" };
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
                {(spawter.display_name?.charAt(0) ?? "S").toUpperCase()}
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

          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <StatBlock label={t("profile.stat_spawts")} value={totalSpawts} theme={theme} />
            <StatBlock label={t("profile.stat_spots")} value={uniqueSpots} theme={theme} />
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
          <PalaisRadarGated
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

function PalaisRadarGated({
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
  return (
    <>
      <AxisRadar
        axes={[
          { value: palais.axe_racines_horizons, negLabel: t("axis.racines"), posLabel: t("axis.horizons") },
          { value: palais.axe_taniere_nomade, negLabel: t("axis.taniere"), posLabel: t("axis.nomade") },
          { value: palais.axe_exigeant_enthousiaste, negLabel: t("axis.exigeant"), posLabel: t("axis.enthousiaste") },
          { value: palais.axe_foule_secret, negLabel: t("axis.foule"), posLabel: t("axis.secret") },
          { value: palais.axe_maquis_table, negLabel: t("axis.maquis"), posLabel: t("axis.table") },
        ]}
        size={220}
        underConstruction={underConstruction}
        underConstructionLabel={t("palais.underConstruction")}
      />
      {visibleAxesCount === 2 && !underConstruction ? (
        <Text
          style={{
            marginTop: theme.spacing.base,
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
    </>
  );
}
