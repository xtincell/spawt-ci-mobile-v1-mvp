import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useOutings } from "../store/outings-store";
import { useMenuItems } from "../lib/use-menu-items";
import type { PlaceWithScore } from "../lib/matching";
import { MenuItemCard } from "./MenuItemCard";
import { DataLoadNotice } from "./DataLoadNotice";
import { ExploreCollections } from "./ExploreCollections";
import { Ico } from "./primitives/Ico";

export function EditorialDiscovery() {
  return <ExploreCollections preview />;
}
export function OutingDiscovery({ ranked }: { ranked: readonly PlaceWithScore[] }) {
  const theme = useTheme(); const { t } = useTranslation(); const router = useRouter();
  const outings = useOutings(); const menu = useMenuItems();
  const order = new Map(ranked.map((r, i) => [r.place.id, i]));
  const chosen = new Set(outings.snapshot.choices.map(choice => choice.place_id));
  const upcoming = ranked.filter(item => chosen.has(item.place.id)).slice(0, 2);
  const seen = new Set<string>();
  const dishes = [...menu.items].filter(d => order.has(d.place_id) && !outings.snapshot.dismissed.includes(d.place_id))
    .sort((a, b) => order.get(a.place_id)! - order.get(b.place_id)!)
    .filter(d => { if (seen.has(d.place_id)) return false; seen.add(d.place_id); return true; }).slice(0, 3);
  const ink = { ...theme.typography.preset.body, color: theme.colors.brand.accent };
  return <View style={{ padding: theme.spacing.lg, gap: theme.spacing.base }}>
    {dishes.length || menu.failed ? <Text accessibilityRole="header" style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{t("outings.dishes")}</Text> : null}
    <DataLoadNotice loading={menu.loading} failed={menu.failed} onRetry={menu.reload} />
    {dishes.map(item => <View key={item.id}><MenuItemCard item={item} visual /><Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => void outings.perform("dismiss", { place_id: item.place_id }).catch(() => Alert.alert(t("outings.failed")))}><Text style={ink}>{t("outings.not_for_me")}</Text></Pressable></View>)}
    <View style={{ borderTopWidth: 1, borderColor: theme.colors.border.subtle, paddingTop: theme.spacing.sm, gap: theme.spacing.xs }}>
      {upcoming.length > 0 ? (
        <>
          <Text accessibilityRole="header" style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{t("outings.resume")}</Text>
          {upcoming.map(({ place }) => (
            <Pressable key={place.id} accessibilityRole="button"
              style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}
              onPress={() => router.push({ pathname: "/place/[id]", params: { id: place.id, ref: "feed" } })}>
              <Ico name="pin" size={18} color={theme.colors.brand.accent} />
              <Text style={{ flex: 1, ...theme.typography.preset.body, color: theme.colors.text.primary }}>{place.name}</Text>
              <Ico name="chevron-right" size={16} color={theme.colors.text.secondary} />
            </Pressable>
          ))}
        </>
      ) : null}
      <Pressable accessibilityRole="button" style={{ minHeight: 44, flexDirection: "row", gap: theme.spacing.sm, alignItems: "center" }} onPress={() => router.push("/saved")}>
        <Ico name="bookmark" size={18} color={theme.colors.brand.accent} /><Text style={ink}>{t("outings.browse")}</Text>
      </Pressable>
    </View>
  </View>;
}
