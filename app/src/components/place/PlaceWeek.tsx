import { useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Place } from "../../types/place";
import { useTheme } from "../../theme/ThemeProvider";
import { OpeningHours, todayKey } from "../OpeningHours";
import { Ico } from "../primitives/Ico";
import { isOpenAt } from "../../lib/opening-hours";

// Evaluate the posted schedule on the restaurant's wall clock, including yesterday's overnight service.
const cityZones: Record<string, string> = {abidjan: "Africa/Abidjan", dakar: "Africa/Dakar", douala: "Africa/Douala"};
export function placeClock(city: string, instant: Date): Date | undefined {
  const timeZone = cityZones[city.trim().toLowerCase()];
  if (!timeZone) return;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(instant);
    const num = (type: string) => Number(parts.find(p => p.type === type)?.value);
    return new Date(num("year"), num("month") - 1, num("day"), num("hour"), num("minute"));
  } catch { return; }
}

export function PlaceWeek({ hours, city }: { hours: Place["hours"]; city: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [instant, setInstant] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setInstant(new Date());
    const tick = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => { clearInterval(tick); subscription.remove(); };
  }, []);
  if (!Object.keys(hours).length) return null;
  const local = placeClock(city, instant);
  const day = local && todayKey(local);
  const prev = local && new Date(local.getFullYear(), local.getMonth(), local.getDate() - 1);
  const open = local && isOpenAt(hours, local);
  const canShowClosed = day && prev && hours[day] !== undefined && hours[todayKey(prev)] !== undefined;
  const label = open ? t("place.now_open") : canShowClosed ? t("place.now_closed") : t("place.info_hours");
  return <View style={{ backgroundColor: theme.colors.surface.raised, borderWidth: 1, borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.lg, marginBottom: theme.spacing.base, paddingHorizontal: theme.spacing.base }}>
    <Pressable testID="place-week-toggle" accessibilityRole="button" accessibilityState={{expanded}} onPress={() => setExpanded(v => !v)}
      style={{flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, minHeight: 52}}>
      <Ico name="clock" size={20} color={theme.colors.brand.accent}/>
      <View style={{flex: 1, paddingVertical: theme.spacing.xs}}>
        <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>{label}</Text>
        <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("place.week_schedule")}</Text>
      </View><Ico name={expanded ? "arrow-up" : "chevron-down"} size={16}/>
    </Pressable>
    {expanded ? <View style={{ paddingBottom: theme.spacing.base }}><OpeningHours hours={hours} today={day} highlightToday={Boolean(day)}/></View> : null}
  </View>;
}
