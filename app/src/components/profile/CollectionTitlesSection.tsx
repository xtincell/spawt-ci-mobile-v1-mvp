// Story 5.3 — Section « Collection de titres » dans le profil.
// Pas d'animation gamifiée (anti-Duolingo). Pastilles à toggle simple.
// CR Chunk A D5 — pastille "Titre par défaut" pour désélectionner un custom.

import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import type { CollectionTitreRow } from "../../types/collection-titres";
import { STADE_TITLE_KEYS } from "../../lib/titres-catalogue";
import type { Stade } from "../../types/stade";

interface Props {
  collectionTitres: CollectionTitreRow[];
  displayedTitleKey: string;
  /** Stade actuel — sert à savoir quel titre est "le défaut" (pas un choix custom). */
  currentStade: Stade;
  onSetDisplayed: (title_key: string) => void;
  /** CR D5 — Désélectionne le custom et revient au titre par défaut du stade. */
  onClearDisplayed: () => void;
}

export function CollectionTitlesSection({
  collectionTitres,
  displayedTitleKey,
  currentStade,
  onSetDisplayed,
  onClearDisplayed,
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

  // CR D5 — Considéré comme "défaut actif" si aucun row n'est is_displayed OU
  // si le row is_displayed = STADE_TITLE_KEYS[currentStade]. Dans les deux cas,
  // le user n'a pas exprimé de préférence custom.
  const defaultTitleKey = STADE_TITLE_KEYS[currentStade];
  const isDefaultActive =
    displayedTitleKey === defaultTitleKey ||
    !sorted.some((r) => r.is_displayed);

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
        {/* Pastille "Titre par défaut" (CR D5) — désélectionne le custom. */}
        <Pressable
          key="__default__"
          onPress={() => {
            if (!isDefaultActive) onClearDisplayed();
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: isDefaultActive }}
          accessibilityLabel={t("profile.title_default_aria")}
          style={({ pressed }) => ({
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.base,
            borderRadius: theme.radius.full,
            backgroundColor: isDefaultActive
              ? theme.colors.brand.primary
              : theme.colors.surface.subtle,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: isDefaultActive
              ? theme.colors.brand.primary
              : theme.colors.border.subtle,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: isDefaultActive ? theme.colors.text.onBrand : theme.colors.text.tertiary,
              fontStyle: "italic",
            }}
          >
            {t("profile.title_default_label")}
          </Text>
        </Pressable>

        {sorted.map((row) => {
          const isDisplayed = row.title_key === displayedTitleKey && !isDefaultActive;
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
