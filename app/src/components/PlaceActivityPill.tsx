// Événements & promotions (0049 + 0050) — pastille DISCRÈTE de carte feed.
// Composant PUR : reçoit les drapeaux déjà chargés par lot (listPlaceActivity,
// jamais un fetch par carte) et rend au plus deux mini-pills « Promo » /
// « Événement ». Rien si aucun drapeau — la carte reste identique (flag off →
// la map est vide → non-régression garantie par construction).
//
// ⚠️ Contrat SPAWT : la pastille ÉTIQUETTE, elle ne classe pas — l'ordre du
// feed vient de matching.ts qui ignore tout des promos.

import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import type { PlaceActivityFlags } from "../lib/place-activity";

interface Props {
  activity?: PlaceActivityFlags | undefined;
}

export function PlaceActivityPill({ activity }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (!activity || (!activity.has_promo && !activity.has_event)) return null;

  return (
    <View
      style={{ flexDirection: "row", gap: theme.spacing.xs }}
      testID="place-activity-pill"
    >
      {activity.has_promo ? (
        <View
          testID="activity-pill-promo"
          style={{
            backgroundColor: theme.colors.brand.primary,
            borderRadius: theme.radius.full,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.text.onBrand,
            }}
          >
            {t("place_activity.pill_promo")}
          </Text>
        </View>
      ) : null}
      {activity.has_event ? (
        <View
          testID="activity-pill-event"
          style={{
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.colors.brand.primary,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.brand.primary,
            }}
          >
            {t("place_activity.pill_event")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
