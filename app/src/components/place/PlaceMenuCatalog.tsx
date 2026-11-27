import { useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { type CatalogDish, leChaMenuId, menuPreviews, placeDishes, previewPhotoCredit } from "../../lib/place-menu-catalog";
import { useMenuItems } from "../../lib/use-menu-items";
import { DataLoadNotice } from "../DataLoadNotice";
import { OutingActions } from "../OutingActions";
import { Ico } from "../primitives/Ico";
import { PlaceSectionHeader } from "./PlaceSectionHeader";

export interface PlaceMenuProps {
  placeName?: string;
  locationLabel?: string;
  onOpenMenu?: () => void;
}

const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function Prices({ dish }: { dish: CatalogDish }) {
  const { t } = useTranslation();
  const { colors, typography: { preset } } = useTheme();
  const money = (amount: number) => t("outings.price", { price: amount.toLocaleString("fr-FR") });
  const price = dish.price != null ? money(dish.price) : null;
  return <View>
    {price && <Text style={{ ...preset.data, color: colors.brand.accent, fontFamily: "Gotham-Bold" }}>{price}</Text>}
    {dish.variants.map(v => <Text key={v.label} style={{ ...preset.data, color: colors.brand.accent }}>
      {v.label} · {money(v.price_xof)}
    </Text>)}
    {!price && !dish.variants.length && <Text style={{ ...preset.small, color: colors.text.secondary }}>{t("outings.price_unknown")}</Text>}
  </View>;
}

function DishImage({ uri, preview }: { uri: string | null; preview: boolean }) {
  const { colors, radius } = useTheme();
  const [failed, setFailed] = useState<string>();
  if (!uri || failed === uri) return preview ? (
    <View accessible={false} style={{ width: "100%", aspectRatio: 1.8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.subtle }}>
      <Ico name="fork" size={42} color={colors.brand.accent} />
    </View>
  ) : null;
  return <Image accessible={false} source={{ uri }} onError={() => setFailed(uri)} resizeMode="cover"
    style={preview ? { width: "100%", aspectRatio: 1.8 } : { width: 64, height: 64, borderRadius: radius.md }} />;
}

function DishSheet({ dish, close }: { dish: CatalogDish; close: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, typography: { preset } } = useTheme();
  return <Modal visible animationType="slide" onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}><ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base }}>
      <Pressable testID="menu-dismiss" accessibilityRole="button" onPress={close} style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}>
        <Text style={{ ...preset.body, color: colors.brand.accent }}>{t("common.close")}</Text>
      </Pressable>
      {dish.photoUrl && <DishImage uri={dish.photoUrl} preview />}
      <Text accessibilityRole="header" style={{ ...preset.h1, color: colors.text.primary }}>{dish.name}</Text>
      <Prices dish={dish} />
      {dish.description ? <Text style={{ ...preset.body, color: colors.text.secondary }}>{dish.description}</Text> : null}
      {dish.choices.length ? <Text style={{ ...preset.small, color: colors.text.secondary }}>{t("menu_detail.choices", { choices: dish.choices.join(", ") })}</Text> : null}
      {dish.published?.is_published && <OutingActions placeId={dish.published.place_id} dish={dish.published} />}
    </ScrollView></SafeAreaView>
  </Modal>;
}

function DishCard({ dish, width, open }: { dish: CatalogDish; width?: number; open: () => void }) {
  const { colors, spacing, radius, typography: { preset } } = useTheme();
  const { fontScale } = useWindowDimensions();
  const preview = width !== undefined;
  return <Pressable accessibilityRole="button" testID={`menu-dish-${dish.key}`} onPress={open}
    style={preview ? { width, backgroundColor: colors.surface.raised, borderWidth: 1, borderColor: colors.border.subtle,
      borderRadius: radius.lg, overflow: "hidden" } : { flexDirection: "row", gap: spacing.md, alignItems: "center",
      borderBottomWidth: 1, borderColor: colors.border.subtle, paddingVertical: spacing.md }}>
    <DishImage uri={dish.photoUrl} preview={preview} />
    <View style={{ flex: 1, gap: spacing.xs, padding: preview ? spacing.md : 0 }}>
      <Text numberOfLines={2} style={{ ...preset.h2, color: colors.text.primary, ...(preview && { minHeight: preset.h2.lineHeight * 2 * fontScale }) }}>{dish.name}</Text>
      <Prices dish={dish} />
      {dish.description ? <Text numberOfLines={preview ? 2 : 3} style={{ ...preset.small, color: colors.text.secondary }}>{dish.description}</Text> : null}
    </View>
    {!preview && <Ico name="chevron-right" size={16} color={colors.brand.accent} />}
  </Pressable>;
}

export function PlaceMenuCatalog({ placeId, placeName, locationLabel, onOpenMenu }: PlaceMenuProps & { placeId: string }) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography: { preset } } = useTheme();
  const { width } = useWindowDimensions();
  const { dish: linked } = useLocalSearchParams<{ dish?: string }>();
  const menu = useMenuItems(placeId);
  const dishes = useMemo(() => placeDishes(placeId, menu.items), [placeId, menu.items]);
  const families = [...new Set(dishes.map(d => d.family))];
  const [family, setFamily] = useState("");
  const [query, setQuery] = useState("");
  const [info, setInfo] = useState(false);
  const [chosen, setChosen] = useState<string | null | undefined>();
  const selected = dishes.find(dish => dish.key === (chosen === undefined && !onOpenMenu ? linked : chosen));
  const current = families.includes(family) ? family : families[0];
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  const groups = new Map<string, CatalogDish[]>();
  for (const dish of dishes) {
    if (terms.length) {
      const text = normalized([dish.name, dish.family, dish.section, dish.description, ...dish.choices, ...(dish.published?.aliases ?? [])].join(" "));
      if (!terms.every(term => text.includes(term))) continue;
    } else if (dish.family !== current) continue;
    const section = groups.get(dish.section);
    if (section) section.push(dish);
    else groups.set(dish.section, [dish]);
  }
  const sources = [...new Set(dishes.filter(d => d.observed || d.source).map(d => [
    d.source, d.observed ? t("outings.observed", { date: d.observed.split("-").reverse().join("/") }) : "",
  ].filter(Boolean).join(" · ")))];
  const cardWidth = Math.min(Math.round(width * 0.68), 264);
  const infoButton = <Pressable testID="menu-information" accessibilityRole="button" accessibilityLabel={t("menu_detail.info")}
    onPress={() => setInfo(true)} style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center" }}>
    <Text style={{ ...preset.small, color: colors.text.inverse }}>ⓘ  {t("menu_detail.info")}</Text>
  </Pressable>;
  return <View testID="place-native-menu" style={{ gap: spacing.base }}>
    {onOpenMenu ? <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text accessibilityRole="header" style={{ ...preset.h2, flex: 1, color: colors.text.primary }}>{t("menu_detail.preview")}</Text>
      <Pressable testID="menu-information" accessibilityLabel={t("menu_detail.info")} accessibilityRole="button" onPress={() => setInfo(true)}
        style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ ...preset.h2, color: colors.brand.accent }}>ⓘ</Text></Pressable>
    </View> : <PlaceSectionHeader icon="fork" title={t("place.tab_menu")} {...(placeName && { eyebrow: placeName })} {...(locationLabel && { meta: locationLabel })} action={infoButton} />}
    <DataLoadNotice loading={menu.loading && !dishes.length} failed={menu.failed} onRetry={menu.reload} />
    {dishes.length ? onOpenMenu ? <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + spacing.sm} decelerationRate="fast"
        contentContainerStyle={{ gap: spacing.sm, alignItems: "stretch" }}>
        {menuPreviews(dishes, placeId).map(dish => <DishCard key={dish.key} dish={dish} width={cardWidth} open={() => setChosen(dish.key)} />)}
      </ScrollView>
      <Pressable testID="open-full-menu" accessibilityRole="button" onPress={onOpenMenu} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={{ ...preset.body, color: colors.brand.accent }}>{t("menu_detail.full")}</Text><Ico name="arrow-right" size={17} color={colors.brand.accent} />
      </Pressable>
    </> : <>
      {dishes.length > 6 && <TextInput accessibilityLabel={t("menu_detail.search")} placeholder={t("menu_detail.search")} value={query} onChangeText={setQuery}
        placeholderTextColor={colors.text.secondary} style={{ ...preset.body, color: colors.text.primary,
          backgroundColor: colors.surface.editorial, minHeight: 44, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border.subtle }} />}
      {families.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        {families.map(name => <Pressable accessibilityRole="tab" accessibilityState={{ selected: !terms.length && current === name }} key={name}
          onPress={() => { setFamily(name); setQuery(""); }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.base,
            borderRadius: radius.full, backgroundColor: !terms.length && current === name ? colors.brand.accent : colors.surface.subtle }}>
          <Text style={{ ...preset.small, color: !terms.length && current === name ? colors.text.inverse : colors.text.primary }}>{name || t("menu_detail.other")}</Text>
        </Pressable>)}
      </ScrollView>}
      {[...groups].map(([title, entries]) => <View key={title}>{title ? <Text accessibilityRole="header" style={{ ...preset.h2, color: colors.brand.accent }}>{title}</Text> : null}
        {entries.map(dish => <DishCard key={dish.key} dish={dish} open={() => setChosen(dish.key)} />)}</View>)}
      {!groups.size && <Text style={{ ...preset.body, color: colors.text.secondary }}>{t("menu_detail.no_results")}</Text>}
    </> : !menu.loading && !menu.failed ? <Text style={{ ...preset.body, color: colors.text.secondary }}>{t("place.menu_empty_title")}</Text> : null}
    {selected && <DishSheet dish={selected} close={() => setChosen(null)} />}
    {info && <Modal visible transparent animationType="fade" onRequestClose={() => setInfo(false)}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay.modal }}>
        <SafeAreaView style={{ maxHeight: "85%", backgroundColor: colors.surface.raised, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <Text accessibilityRole="header" style={{ ...preset.h2, color: colors.text.primary }}>{t("menu_detail.info")}</Text>
          <ScrollView>{sources.length ? sources.map(s => <Text key={s} style={{ ...preset.body, color: colors.text.secondary, marginBottom: spacing.sm }}>{s}</Text>)
            : <Text style={{ ...preset.body, color: colors.text.secondary }}>{t("menu_detail.no_metadata")}</Text>}
            {__DEV__ && placeId === leChaMenuId && dishes.some(d => d.photoUrl?.includes("eda-dostavka.com")) && <Text style={{ ...preset.small, color: colors.text.secondary }}>{t("menu_detail.photo_credit", { credit: previewPhotoCredit })}</Text>}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setInfo(false)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...preset.body, color: colors.brand.accent }}>{t("common.close")}</Text></Pressable>
        </SafeAreaView>
      </View>
    </Modal>}
  </View>;
}
