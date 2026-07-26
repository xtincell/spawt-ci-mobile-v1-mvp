// WrappedBanner — bannière feed « ton année avec la Meute est prête ».
// Rendue par le feed UNIQUEMENT si flag `wrapped` actif ET saison Wrapped
// (1er décembre → 15 janvier, lib/wrapped.ts) — hors fenêtre, rien ne change
// au feed (non-régression stricte).

import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "../primitives/Ico";

interface Props {
  year: number;
  onPress: () => void;
}

export function WrappedBanner({ year, onPress }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("wrapped.banner_aria", { year })}
      testID="wrapped-banner"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.base,
        marginHorizontal: theme.spacing.lg,
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.brand.primary,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ico name="star" size={20} color={theme.colors.brand.primary} filled />
      <View style={{ flex: 1 }}>
        <Text
          style={{ ...theme.typography.preset.h3, color: theme.colors.brand.primary }}
        >
          {t("wrapped.banner_title", { year })}
        </Text>
        <Text
          style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}
        >
          {t("wrapped.banner_body")}
        </Text>
      </View>
      <Ico name="chevron-right" size={18} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}
