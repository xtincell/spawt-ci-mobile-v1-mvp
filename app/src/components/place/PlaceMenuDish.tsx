import { useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import type { CatalogDish } from "../../lib/place-menu-catalog";
import type { MenuItem } from "../../lib/outings";
import { useOutingsStore } from "../../store/outings-store";
import { useSpawterStore } from "../../store/spawter-store";
import { OutingActions } from "../OutingActions";
import { Ico } from "../primitives/Ico";

function Prices({ dish }: { dish: CatalogDish }) {
  const { t } = useTranslation();
  const { colors, typography: { preset } } = useTheme();
  const money = (amount: number) => t("outings.price", { price: amount.toLocaleString("fr-FR") });
  const style = { ...preset.body, fontFamily: "Gotham-Bold", color: colors.chat.djidji };
  return <View>
    {dish.price != null && <Text style={style}>{money(dish.price)}</Text>}
    {dish.variants.map(v => <Text key={v.label} style={style}>{v.label} · {money(v.price_xof)}</Text>)}
    {dish.price == null && !dish.variants.length && <Text style={{ ...preset.small, color: colors.text.secondary }}>{t("outings.price_unknown")}</Text>}
  </View>;
}

function Favorite({ item }: { item: MenuItem }) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const owner = useSpawterStore(s => s.spawter?.id);
  const saved = useOutingsStore(s => s.owner === owner && s.snapshot.dishes.some(d => d.id === item.id));
  const perform = useOutingsStore(s => s.perform);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try { await perform(saved ? "unsave" : "save", { menu_item_id: item.id }, item); }
    catch { Alert.alert(t("outings.failed")); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <Pressable testID={`menu-favorite-${item.id}`} onPress={() => void toggle()} accessibilityRole="button"
    accessibilityLabel={t(saved ? "outings.remove_dish" : "outings.save_dish") + " · " + item.name}
    accessibilityState={{ selected: saved, disabled: busy }} disabled={busy}
    style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
    <View style={{ borderRadius: radius.full, borderWidth: 1, borderColor: saved ? colors.chat.djidji : colors.border.strong,
      width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: saved ? colors.chat.djidji : colors.surface.raised }}>
      <Ico name="heart" size={18} filled={saved} color={saved ? colors.text.inverse : colors.chat.djidji} />
    </View>
  </Pressable>;
}

function DishImage({ source, large }: { source?: ImageSourcePropType | undefined; large?: boolean }) {
  const { radius } = useTheme();
  const [failed, setFailed] = useState<string>();
  const key = JSON.stringify(source);
  if (!source || failed === key) return null;
  return <Image accessible={false} source={source} onError={() => setFailed(key)} resizeMode="cover"
    style={large ? { width: "100%", aspectRatio: 1.63 } : { width: 61, height: 67, borderRadius: radius.md }} />;
}

export function DishSheet({ dish, photo, close }: { dish: CatalogDish; photo?: ImageSourcePropType | undefined; close: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, typography: { preset } } = useTheme();
  return <Modal visible animationType="slide" onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}><ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base }}>
      <Pressable testID="menu-dismiss" accessibilityRole="button" onPress={close} style={{ alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ico name="arrow-left" size={18} color={colors.brand.accent} /><Text style={{ ...preset.body, color: colors.brand.accent }}>{t("common.close")}</Text>
      </Pressable>
      <DishImage source={photo} large />
      <Text accessibilityRole="header" style={{ ...preset.h1, color: colors.text.primary }}>{dish.name}</Text>
      <Prices dish={dish} />
      {dish.description ? <Text style={{ ...preset.body, color: colors.text.secondary }}>{dish.description}</Text> : null}
      {dish.choices.length ? <Text style={{ ...preset.small, color: colors.text.secondary }}>{t("menu_detail.choices", { choices: dish.choices.join(", ") })}</Text> : null}
      {dish.published && <OutingActions placeId={dish.published.place_id} dish={dish.published} />}
    </ScrollView></SafeAreaView>
  </Modal>;
}

interface DishProps {
  dish: CatalogDish;
  photo?: ImageSourcePropType | undefined;
  open: () => void;
  width?: number;
  reservePhoto?: boolean;
}
export function DishCard({ dish, photo, open, width, reservePhoto }: DishProps) {
  const { colors, spacing, radius, typography: { preset } } = useTheme();
  const { fontScale } = useWindowDimensions();
  const preview = width !== undefined;
  const title = <Text numberOfLines={preview ? 2 : undefined} style={{ ...preset.h2, color: colors.text.primary,
    ...(preview && { minHeight: 2 * preset.h2.lineHeight * fontScale }) }}>{dish.name}</Text>;
  const description = dish.description ? <Text numberOfLines={preview ? 2 : 3} style={{ ...preset.small, color: colors.text.secondary }}>{dish.description}</Text> : null;
  if (preview) return <View style={{ width, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radius.lg, backgroundColor: colors.surface.raised, overflow: "hidden" }}>
    <Pressable testID={`menu-dish-${dish.key}`} onPress={open} accessibilityRole="button" style={{ flex: 1 }}>
      {reservePhoto && <View style={{ width: "100%", aspectRatio: 1.63, backgroundColor: colors.surface.subtle, alignItems: "center", justifyContent: "center" }}>
        {photo ? <DishImage source={photo} large /> : <Ico name="fork" color={colors.brand.accent} size={26} />}
      </View>}
      <View style={{ padding: spacing.md, gap: spacing.xs }}>{title}<Prices dish={dish} />{description}</View>
    </Pressable>
    {dish.published && <View style={{ alignItems: "flex-end", paddingRight: spacing.sm }}><Favorite item={dish.published} /></View>}
  </View>;
  return <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.border.strong, gap: spacing.xs }}>
    <Pressable testID={`menu-dish-${dish.key}`} onPress={open} accessibilityRole="button"
      style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, minHeight: 68 }}>
      <DishImage source={photo} />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>{title}<Prices dish={dish} />{description}</View>
    </Pressable>
    {dish.published && <Favorite item={dish.published} />}
  </View>;
}

