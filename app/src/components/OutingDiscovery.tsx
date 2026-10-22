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

export function EditorialDiscovery() {
  const theme = useTheme(); const { t } = useTranslation();
  return <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
    <Text accessibilityRole="header" style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{t("outings.editorial")}</Text>
    <ExploreCollections limit={1} />
  </View>;
}
export function OutingDiscovery({ ranked }: { ranked: readonly PlaceWithScore[] }) {
  const theme = useTheme(); const { t } = useTranslation(); const router = useRouter();
  const outings = useOutings(); const menu = useMenuItems();
  const order = new Map(ranked.map((r, i) => [r.place.id, i]));
  const seen = new Set<string>();
  const dishes = [...menu.items].filter(d => order.has(d.place_id) && !outings.snapshot.dismissed.includes(d.place_id))
    .sort((a, b) => order.get(a.place_id)! - order.get(b.place_id)!)
    .filter(d => { if (seen.has(d.place_id)) return false; seen.add(d.place_id); return true; }).slice(0, 3);
  const ink = { ...theme.typography.preset.body, color: theme.colors.brand.accent };
  return <View style={{ padding: theme.spacing.lg, gap: theme.spacing.base }}>
    {dishes.length || menu.failed ? <Text accessibilityRole="header" style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{t("outings.dishes")}</Text> : null}
    <DataLoadNotice loading={menu.loading} failed={menu.failed} onRetry={menu.reload} />
    {dishes.map(item => <View key={item.id}><MenuItemCard item={item} visual /><Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => void outings.perform("dismiss", { place_id: item.place_id }).catch(() => Alert.alert(t("outings.failed")))}><Text style={ink}>{t("outings.not_for_me")}</Text></Pressable></View>)}
    <View style={{ borderTopWidth: 1, borderColor: theme.colors.text.tertiary, paddingTop: theme.spacing.base, gap: theme.spacing.sm }}>
      <Text accessibilityRole="header" style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{t("outings.resume")}</Text>
      {outings.snapshot.lists.slice(0, 3).map(l => <Text key={l.id} style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>{l.title}</Text>)}
      <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => router.push("/saved")}><Text style={ink}>{t("outings.browse")}</Text></Pressable>
    </View>
  </View>;
}
