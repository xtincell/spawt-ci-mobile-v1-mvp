// Progression — section Badges : grille par catégorie, verrouillés grisés
// avec condition lisible, tap = détail + toggle « afficher sur mon profil »
// (max 3 — feedback si dépassé). Collection personnelle, jamais un palmarès
// (Contrat SPAWT).

import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "../primitives/Ico";
import type { BadgeWithState } from "../../types/progression";
import { groupBadgesByCategory } from "../../lib/progression-engine";

interface Props {
  badges: readonly BadgeWithState[];
  /** Toggle store — retourne "max" si 3 badges sont déjà affichés. */
  onToggleDisplayed: (code: string) => Promise<"ok" | "max" | "error">;
}

/** Condition lisible d'un badge verrouillé (clé par condition_type + seuil). */
function conditionText(t: TFunction, badge: BadgeWithState): string {
  return t(`badge_condition.${badge.condition_type}`, {
    count: badge.threshold ?? 1,
  });
}

export function BadgesSection({ badges, onToggleDisplayed }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const groups = groupBadgesByCategory(badges);
  const selected = badges.find((b) => b.code === selectedCode) ?? null;
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const onToggle = async (badge: BadgeWithState) => {
    const result = await onToggleDisplayed(badge.code);
    if (result === "max") {
      // Feedback max-3 : sobre, actionnable — retirer un badge d'abord.
      Alert.alert(
        t("progression.badges_display_max_title"),
        t("progression.badges_display_max_body"),
      );
    }
  };

  return (
    <View testID="progression-badges-section" style={{ gap: theme.spacing.base }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>
          {t("progression.badges_title")}
        </Text>
        <Text style={{ ...theme.typography.preset.data, color: theme.colors.text.tertiary }}>
          {t("progression.badges_count", { unlocked: unlockedCount, total: badges.length })}
        </Text>
      </View>

      {groups.map((group) => (
        <View key={group.category} style={{ gap: theme.spacing.sm }}>
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.text.tertiary,
            }}
          >
            {t(`progression.category.${group.category}`)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {group.badges.map((badge) => (
              <BadgeTile
                key={badge.code}
                badge={badge}
                isSelected={badge.code === selectedCode}
                onPress={() =>
                  setSelectedCode(badge.code === selectedCode ? null : badge.code)
                }
              />
            ))}
          </View>
        </View>
      ))}

      {selected ? (
        <BadgeDetail
          badge={selected}
          onToggle={() => {
            void onToggle(selected);
          }}
        />
      ) : null}
    </View>
  );
}

/** Pastille de badge — débloqué en or, verrouillé grisé. */
function BadgeTile({
  badge,
  isSelected,
  onPress,
}: {
  badge: BadgeWithState;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const title = t(badge.title_key);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={t(
        badge.unlocked
          ? "progression.badge_tile_unlocked_aria"
          : "progression.badge_tile_locked_aria",
        { title },
      )}
      testID={`badge-tile-${badge.code}`}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.base,
        borderRadius: theme.radius.full,
        backgroundColor: badge.unlocked
          ? theme.colors.surface.subtle
          : theme.colors.surface.raised,
        borderWidth: 1,
        borderColor: isSelected
          ? theme.colors.brand.primary
          : theme.colors.border.subtle,
        opacity: pressed ? 0.8 : badge.unlocked ? 1 : 0.45,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.xs,
      })}
    >
      {!badge.unlocked ? (
        <Ico name="lock" size={12} color={theme.colors.text.tertiary} />
      ) : badge.is_displayed ? (
        <Ico name="star" size={12} color={theme.colors.brand.primary} filled />
      ) : null}
      <Text
        style={{
          ...theme.typography.preset.caption,
          color: badge.unlocked ? theme.colors.text.primary : theme.colors.text.tertiary,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** Détail du badge sélectionné : description, condition, %, toggle profil. */
function BadgeDetail({
  badge,
  onToggle,
}: {
  badge: BadgeWithState;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      testID={`badge-detail-${badge.code}`}
      style={{
        padding: theme.spacing.base,
        backgroundColor: theme.colors.surface.subtle,
        borderRadius: theme.radius.lg,
        gap: theme.spacing.sm,
      }}
    >
      <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.primary }}>
        {t(badge.title_key)}
      </Text>
      <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
        {t(badge.description_key)}
      </Text>

      {!badge.unlocked ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.tertiary }}>
            {conditionText(t, badge)}
          </Text>
          {/* % de progression : seulement quand la métrique est calculable
              côté client — jamais un chiffre inventé. */}
          {badge.progress_percent !== null ? (
            <View style={{ gap: theme.spacing.xs }}>
              <View
                style={{
                  height: 4,
                  backgroundColor: theme.colors.border.subtle,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  testID={`badge-progress-${badge.code}`}
                  style={{
                    width: `${Math.round(badge.progress_percent * 100)}%`,
                    height: "100%",
                    backgroundColor: theme.colors.brand.primary,
                  }}
                />
              </View>
              <Text
                style={{ ...theme.typography.preset.data, color: theme.colors.text.tertiary }}
              >
                {t("progression.badge_progress_label", {
                  current: badge.progress_current ?? 0,
                  threshold: badge.threshold ?? 1,
                })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ selected: badge.is_displayed }}
          accessibilityLabel={t("progression.badge_display_toggle_aria")}
          testID={`badge-display-toggle-${badge.code}`}
          style={({ pressed }) => ({
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.base,
            borderRadius: theme.radius.full,
            alignSelf: "flex-start",
            backgroundColor: badge.is_displayed
              ? theme.colors.brand.primary
              : theme.colors.surface.raised,
            borderWidth: 1,
            borderColor: badge.is_displayed
              ? theme.colors.brand.primary
              : theme.colors.border.strong,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: badge.is_displayed
                ? theme.colors.text.onBrand
                : theme.colors.text.primary,
            }}
          >
            {badge.is_displayed
              ? t("progression.badge_display_on")
              : t("progression.badge_display_off")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
