import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Place } from "../../types/place";
import { useTheme } from "../../theme/ThemeProvider";
import { usePlaces } from "../../lib/use-places";
import { formatDistance, listNearbyPlaces } from "../../lib/nearby-places";
import { DataLoadNotice } from "../DataLoadNotice";
import { Ico } from "../primitives/Ico";

export function PlaceNeighbors({ place }: { place: Place }) {
  const [expanded, setExpanded] = useState(false);
  const { places, loading, failed, reload } = usePlaces(expanded);
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { lat, lng, city } = place.location;
  if (!city || lat === null || lng === null || (lat === 0 && lng === 0)) return null;
  const nearby = expanded ? listNearbyPlaces(places.filter(p => p.id !== place.id &&
    p.location.city.toLowerCase() === city.toLowerCase() && !(p.location.lat === 0 && p.location.lng === 0)), lat, lng, 3) : [];
  return <View style={{ marginTop: theme.spacing.lg }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(v => !v)}
      style={{ flexDirection: "row", alignItems: "center", minHeight: 48, gap: theme.spacing.sm }}>
      <Ico name="compass"/><Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.primary, flex: 1 }}>{t("place.around_here")}</Text>
      <Ico name={expanded ? "arrow-up" : "chevron-down"} size={16}/>
    </Pressable>
    {expanded ? <>
      <DataLoadNotice loading={loading} failed={failed} onRetry={reload}/>
      {!loading && !failed && !nearby.length ? <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("place.neighbors_empty")}</Text> : null}
      {nearby.map(({ place: neighbor, distance_km }) => <Pressable key={neighbor.id} accessibilityRole="button"
        onPress={() => router.push({pathname: "/place/[id]", params: {id: neighbor.id}})}
        style={{flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, minHeight: 52, borderBottomWidth: 1, borderColor: theme.colors.border.subtle}}>
        <View style={{flex: 1}}><Text style={{...theme.typography.preset.body, color: theme.colors.text.primary}}>{neighbor.name}</Text>
        <Text style={{...theme.typography.preset.small, color: theme.colors.text.secondary}}>{t("place.from_here", {distance: formatDistance(distance_km).replace(".", ",")})}</Text></View>
        <Ico name="chevron-right" size={16}/>
      </Pressable>)}
    </> : null}
  </View>;
}
