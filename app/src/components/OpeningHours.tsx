// Story 4.12 — AC #2 : horaires affichés sur les 7 jours (Lun→Dim) à partir
// du `hours JSONB` déjà peuplé (place.ts:98). Le jour courant est mis en
// évidence ; un jour sans créneau affiche « Fermé ». Aucune migration.
//
// Composant extrait (testable isolément) — rend une ligne par jour avec ses
// créneaux open–close. Plusieurs créneaux le même jour (midi + soir) listés.

import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import type { DayOfWeek, OpeningSlot } from "../types/place";

// Ordre d'affichage FR (lundi en tête), distinct de Date.getDay() (0=dim).
const DISPLAY_ORDER: readonly DayOfWeek[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

// Mapping Date.getDay() (0=dim … 6=sam) → clé DayOfWeek.
const JS_DAY_TO_KEY: readonly DayOfWeek[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export function todayKey(now: Date = new Date()): DayOfWeek {
  return JS_DAY_TO_KEY[now.getDay()] ?? "mon";
}

function formatSlots(slots: OpeningSlot[], closedLabel: string): string {
  if (!slots || slots.length === 0) return closedLabel;
  return slots.map((s) => `${s.open} – ${s.close}`).join(" · ");
}

interface Props {
  hours: Record<DayOfWeek, OpeningSlot[]>;
  /** Injection pour tests — sinon dérive du jour réel. */
  today?: DayOfWeek;
}

export function OpeningHours({ hours, today }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const current = today ?? todayKey();
  const closedLabel = t("place.info_hours_closed");

  return (
    <View>
      {DISPLAY_ORDER.map((day) => {
        const isToday = day === current;
        const slots = hours[day] ?? [];
        return (
          <View
            key={day}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: theme.spacing.xs,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.small,
                color: isToday
                  ? theme.colors.text.primary
                  : theme.colors.text.secondary,
                fontWeight: isToday ? "700" : "400",
              }}
            >
              {t(`place.day_${day}`)}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.small,
                color: isToday
                  ? theme.colors.brand.accent
                  : theme.colors.text.primary,
                fontWeight: isToday ? "700" : "400",
                flex: 1,
                textAlign: "right",
                marginLeft: 12,
              }}
            >
              {formatSlots(slots, closedLabel)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
