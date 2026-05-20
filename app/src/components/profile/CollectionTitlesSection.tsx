// Story 5.3 — Section « Collection de titres » dans le profil.
// Pas d'animation gamifiée (anti-Duolingo). Pastilles à toggle simple.

import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import type { CollectionTitreRow } from "../../types/collection-titres";

interface Props {
  collectionTitres: CollectionTitreRow[];
  displayedTitleKey: string;
  onSetDisplayed: (title_key: string) => void;
}

export function CollectionTitlesSection({
  collectionTitres,
  displayedTitleKey,
  onSetDisplayed,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (collectionTitres.length === 0) {
    return (
      <View style={{ paddingVertical: theme.spacing.base }}>
        <Text
          style={{
            ...theme.typography.preset.caption,
            color: theme.colors.text.tertiary,
            marginBottom: theme.spacing.xs,
          }}
        >
          {t("profile.collection_title")}
        </Text>
        <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
          {t("profile.collection_empty")}
        </Text>
      </View>
    );
  }

  const sorted = [...collectionTitres].sort((a, b) =>
    b.unlocked_at.localeCompare(a.unlocked_at),
  );

  return (
    <View>
      <Text
        style={{
          ...theme.typography.preset.caption,
          color: theme.colors.text.tertiary,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("profile.collection_title")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {sorted.map((row) => {
          const isDisplayed = row.title_key === displayedTitleKey;
          return (
            <Pressable
              key={row.id}
              onPress={() => {
                if (!isDisplayed) onSetDisplayed(row.title_key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isDisplayed }}
              accessibilityLabel={t("profile.title_select_aria", {
                title: t(row.title_key),
              })}
              style={({ pressed }) => ({
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.base,
                borderRadius: theme.radius.full,
                backgroundColor: isDisplayed
                  ? theme.colors.brand.primary
                  : theme.colors.surface.subtle,
                borderWidth: 1,
                borderColor: isDisplayed
                  ? theme.colors.brand.primary
                  : theme.colors.border.subtle,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={{
                  ...theme.typography.preset.caption,
                  color: isDisplayed ? theme.colors.text.onBrand : theme.colors.text.primary,
                }}
              >
                {t(row.title_key)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
