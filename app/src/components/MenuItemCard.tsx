import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { PlaceCover } from "./PlaceCover";
import { OutingActions } from "./OutingActions";
import type { MenuItem } from "../lib/outings";

export function MenuItemCard({ item, visual = false }: { item: MenuItem; visual?: boolean }) {
  const theme = useTheme(); const { t } = useTranslation(); const router = useRouter();
  return <View testID={`dish-${item.id}`} style={{ gap: theme.spacing.xs, padding: theme.spacing.base, backgroundColor: theme.colors.surface.subtle, borderRadius: theme.radius.lg }}>
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/place/[id]", params: { id: item.place_id, tab: "menu", dish: item.id } } as never)}>
      {visual && item.photo_url ? <PlaceCover uri={item.photo_url} style={{ height: 180, borderRadius: theme.radius.md, marginBottom: theme.spacing.sm }} /> : null}
      <Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{item.name}</Text>
      <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{item.place_name}</Text>
    </Pressable>
    <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>{item.price_xof === null ? t("outings.price_unknown") : t("outings.price", { price: item.price_xof.toLocaleString("fr-FR") })}</Text>
    <Text style={{ ...theme.typography.preset.caption, color: theme.colors.text.secondary }}>{t("outings.observed", { date: item.observed_on })}</Text>
    {!item.is_published ? <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("outings.retired")}</Text> : <OutingActions placeId={item.place_id} dish={item} />}
  </View>;
}
