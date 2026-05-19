// Story 4.1 — GuetIndicator (visibilité du mécanisme Le Guet).
// PRD §7.1 + UX spec §1304-1310 — "Le Chat fait le guet chez X…"
// Voix neutre complice (pas calibré stade — c'est un feedback fonctionnel, pas narratif).

import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";

export interface GuetIndicatorPlace {
  id: string;
  name: string;
}

interface Props {
  place: GuetIndicatorPlace | null;
  position?: "top" | "bottom";
}

export function GuetIndicator({ place, position = "bottom" }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (!place) return;
    scale.value = withRepeat(
      withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [place, scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!place) return null;

  const label = t("guet.indicator_label", { place_name: place.name });

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        position: "absolute",
        left: theme.spacing.base,
        right: theme.spacing.base,
        [position]: theme.spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.inverse,
        ...theme.elevation.md,
      }}
    >
      <Animated.View
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.state.success,
          },
          pulseStyle,
        ]}
      />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          ...theme.typography.preset.small,
          color: theme.colors.text.inverse,
          flex: 1,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
