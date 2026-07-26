// Événements & promotions (0049) — rangée feed « Ça bouge cette semaine ».
// Flag `evenements-promos` : OFF → null, AUCUN fetch (non-régression). ON →
// petite rangée horizontale des événements qui démarrent dans les 7 jours
// (ou déjà en cours), jointure place minimale. Rien si vide — pas de titre
// orphelin ni d'espace réservé.

import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { useFlag } from "../store/feature-flags";
import { listUpcomingEvents } from "../lib/data-source";
import {
  formatEventDate,
  isEventThisWeek,
  type UpcomingEvent,
} from "../lib/place-activity";

interface Props {
  /** Tap sur une carte → navigation fiche lieu (le parent route). */
  onPlacePress: (placeId: string) => void;
  /** Injection pour tests — bypass le data-source réel. */
  fetcher?: (limit: number) => Promise<UpcomingEvent[]>;
}

export function EventsWeekRow({ onPlacePress, fetcher }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  // Hook appelé inconditionnellement (rules of hooks) — gate au rendu.
  const enabled = useFlag("evenements-promos");
  const [events, setEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => {
    if (!enabled) return; // flag OFF → aucun fetch
    let cancelled = false;
    const fetchEvents = fetcher ?? listUpcomingEvents;
    const now = new Date();
    void fetchEvents(10)
      .then((rows) => {
        if (cancelled) return;
        setEvents(rows.filter((e) => isEventThisWeek(e, now)));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (__DEV__) console.warn("[EventsWeekRow] fetch failed", err);
        setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, fetcher]);

  if (!enabled || events.length === 0) return null;

  return (
    <View style={{ marginTop: theme.spacing.lg }} testID="events-week-row">
      <Text
        style={{
          ...theme.typography.preset.overline,
          color: theme.colors.text.secondary,
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("place_activity.week_title")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
        }}
      >
        {events.map((event) => (
          <Pressable
            key={event.id}
            testID="events-week-card"
            onPress={() => onPlacePress(event.place_id)}
            accessibilityRole="button"
            accessibilityLabel={t("place_activity.week_card_aria", {
              name: event.place_name,
            })}
            style={({ pressed }) => ({
              width: 220,
              padding: theme.spacing.base,
              backgroundColor: theme.colors.surface.raised,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border.subtle,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: theme.colors.brand.primary,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {formatEventDate(event.starts_at)}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.h3,
                color: theme.colors.text.primary,
              }}
              numberOfLines={1}
            >
              {event.title}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.secondary,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {event.place_name}
              {event.place_neighborhood ? ` · ${event.place_neighborhood}` : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
