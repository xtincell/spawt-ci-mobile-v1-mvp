// Progression — section Défis de la Meute : défi collectif actif avec barre
// de progression COLLECTIVE (« La Meute a spawté 620/1000 fois ce mois ») +
// récompense paws, et streak hebdo PRIVÉ.
//
// ⚠️ Contrat SPAWT (PRD §19/§20.1) : JAMAIS de comparaison entre spawters.
// La progression affichée est celle de la Meute ENTIÈRE (challenge_progress,
// 1 ligne par défi, aucun spawter_id) ; le streak est visible du seul
// spawter concerné (RLS owner-only) et n'est jamais mis en regard d'autrui.

import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "../primitives/Ico";
import { challengePercent } from "../../lib/progression-engine";
import type { ActiveChallenge, SpawterStreak } from "../../types/progression";

interface Props {
  challenges: readonly ActiveChallenge[];
  streak: SpawterStreak | null;
}

export function DefisSection({ challenges, streak }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View testID="progression-defis-section" style={{ gap: theme.spacing.base }}>
      <Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>
        {t("progression.defis_title")}
      </Text>

      {challenges.length === 0 ? (
        <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
          {t("progression.defis_empty")}
        </Text>
      ) : (
        challenges.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))
      )}

      {streak ? <StreakCard streak={streak} /> : null}
    </View>
  );
}

/** Carte d'un défi collectif — objectif commun, jamais individuel. */
function ChallengeCard({ challenge }: { challenge: ActiveChallenge }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const percent = challengePercent(challenge);

  return (
    <View
      testID={`defi-card-${challenge.code}`}
      style={{
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface.subtle,
        gap: theme.spacing.sm,
      }}
    >
      <Text style={{ ...theme.typography.preset.overline, color: theme.colors.brand.primary }}>
        {t("progression.defi_kicker")}
      </Text>
      <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.primary }}>
        {t(challenge.title_key)}
      </Text>
      <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
        {t(challenge.description_key)}
      </Text>

      {/* Barre de progression COLLECTIVE. */}
      <View
        style={{
          height: 6,
          backgroundColor: theme.colors.border.subtle,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <View
          testID={`defi-progress-${challenge.code}`}
          style={{
            width: `${Math.round(percent * 100)}%`,
            height: "100%",
            backgroundColor: theme.colors.brand.primary,
          }}
        />
      </View>
      <Text style={{ ...theme.typography.preset.data, color: theme.colors.text.primary }}>
        {t(`progression.defi_progress.${challenge.goal_type}`, {
          current: challenge.current_value,
          target: challenge.goal_target,
        })}
      </Text>

      {challenge.reward_paws > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
          <Ico name="paw" size={14} color={theme.colors.brand.primary} />
          <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>
            {t("progression.defi_reward", { count: challenge.reward_paws })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Streak privé — un rendez-vous avec soi-même, jamais une compétition. */
function StreakCard({ streak }: { streak: SpawterStreak }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      testID="progression-streak-card"
      style={{
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        gap: theme.spacing.xs,
      }}
    >
      <Text style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}>
        {t("progression.streak_title")}
      </Text>
      <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.primary }}>
        {t("progression.streak_current", { count: streak.current_weeks })}
      </Text>
      <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>
        {t("progression.streak_best", { count: streak.best_weeks })}
      </Text>
      <Text
        style={{
          ...theme.typography.preset.small,
          color: theme.colors.text.tertiary,
          fontStyle: "italic",
        }}
      >
        {t("progression.streak_private_hint")}
      </Text>
    </View>
  );
}
