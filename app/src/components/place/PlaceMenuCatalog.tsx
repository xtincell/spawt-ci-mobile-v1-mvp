import { useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { type CatalogDish, inMenuId, leChaMenuId, localMenuPhotography, menuPreviews, normalizedMenuText, placeDishes, previewPhotoCredit } from "../../lib/place-menu-catalog";
import { useMenuItems } from "../../lib/use-menu-items";
import { DataLoadNotice } from "../DataLoadNotice";
import { Ico } from "../primitives/Ico";
import { DishCard, DishSheet } from "./PlaceMenuDish";
import { menuCoverPhoto, menuDishPhoto } from "./place-menu-photos";

export interface PlaceMenuProps {
  menuData?: ReturnType<typeof useMenuItems>;
  placeName?: string | undefined;
  locationLabel?: string | undefined;
  onOpenMenu?: () => void;
  onBackToPlace?: (() => void) | undefined;
}

function InfoButton({ open, inverse = false }: { open: () => void; inverse?: boolean }) {
  const { t } = useTranslation();
  const { colors, typography: { preset } } = useTheme();
  return <Pressable testID="menu-information" accessibilityRole="button" accessibilityLabel={t("menu_detail.info")} onPress={open}
    style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}>
    <Text style={{ ...preset.h2, color: inverse ? colors.text.inverse : colors.chat.djidji }}>ⓘ</Text>
  </Pressable>;
}

interface CoverProps extends PlaceMenuProps { photo?: ImageSourcePropType | undefined; onInfo: () => void }
function MenuCover({ placeName, locationLabel, onBackToPlace, photo, onInfo }: CoverProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography: { preset } } = useTheme();
  const { width } = useWindowDimensions();
  const [failed, setFailed] = useState<string>();
  const photoKey = JSON.stringify(photo);
  const illustrated = !!photo && failed !== photoKey;
  return <View style={{ flexDirection: "row", backgroundColor: colors.chat.djidji, minHeight: 176, overflow: "hidden" }}>
    <View style={{ width: illustrated ? "59%" : "100%", justifyContent: "center", paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
      {onBackToPlace && <Pressable accessibilityRole="button" onPress={onBackToPlace}
        style={{ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ico name="arrow-left" size={16} color={colors.text.inverse} />
        <Text style={{ ...preset.small, color: colors.text.inverse }}>{t("menu_detail.back_to_place")}</Text>
      </Pressable>}
      {!!placeName && <Text style={{ ...preset.body, fontFamily: "Gotham-Medium", color: colors.surface.recommendation }}>{placeName}</Text>}
      <Text accessibilityRole="header" style={{ ...preset.display, fontSize: width < 360 ? 36 : 46, lineHeight: width < 360 ? 41 : 51, letterSpacing: -1.7, color: colors.text.inverse }}>
        {t("menu_detail.preview")}<Text style={{ color: colors.brand.primary }}>.</Text>
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
        {!!locationLabel && <><Ico name="pin" size={14} color={colors.surface.recommendation} />
          <Text style={{ ...preset.small, marginLeft: spacing.xs, flexShrink: 1, color: colors.surface.recommendation }}>{locationLabel}</Text></>}
        <InfoButton open={onInfo} inverse />
      </View>
    </View>
    {illustrated && <Image source={photo} resizeMode="cover" accessible={false} onError={() => setFailed(photoKey)}
      style={{ width: "41%", alignSelf: "stretch", borderTopLeftRadius: 55 }} />}
  </View>;
}

type CatalogProps = PlaceMenuProps & { placeId: string };
export function PlaceMenuCatalog(props: CatalogProps) {
  return props.menuData ? <CatalogBody {...props} menu={props.menuData} /> : <CatalogWithFetch {...props} />;
}
function CatalogWithFetch(props: CatalogProps) {
  const menu = useMenuItems(props.placeId);
  return <CatalogBody {...props} menu={menu} />;
}
function CatalogBody({ placeId, placeName, locationLabel, onOpenMenu, onBackToPlace, menu }: CatalogProps & { menu: ReturnType<typeof useMenuItems> }) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography: { preset } } = useTheme();
  const { width } = useWindowDimensions();
  const { dish: linked } = useLocalSearchParams<{ dish?: string }>();
  const dishes = useMemo(() => placeDishes(placeId, menu.items), [placeId, menu.items]);
  const families = [...new Set(dishes.map(d => d.family))];
  const [family, setFamily] = useState("");
  const [query, setQuery] = useState("");
  const [info, setInfo] = useState(false);
  const [chosen, setChosen] = useState<string | null | undefined>();
  const selected = dishes.find(dish => dish.key === (chosen === undefined && !onOpenMenu ? linked : chosen));
  const current = families.includes(family) ? family : families[0];
  const terms = normalizedMenuText(query).split(/\s+/).filter(Boolean);
  const groups = new Map<string, CatalogDish[]>();
  for (const dish of dishes) {
    if (terms.length) {
      const text = normalizedMenuText([dish.name, dish.family, dish.section, dish.description, ...dish.choices, ...(dish.published?.aliases ?? [])].join(" "));
      if (!terms.every(term => text.includes(term))) continue;
    } else if (dish.family !== current) continue;
    const heading = terms.length && dish.section && dish.family ? [dish.family, dish.section].join(" · ") : dish.section || dish.family;
    const section = groups.get(heading);
    if (section) section.push(dish);
    else groups.set(heading, [dish]);
  }
  const sources = [...new Set(dishes.filter(d => d.observed || d.source).map(d => [
    d.source, d.observed ? t("outings.observed", { date: d.observed.split("-").reverse().join("/") }) : "",
  ].filter(Boolean).join(" · ")))];
  const thumbnails = onOpenMenu ? menuPreviews(dishes, placeId) : [];
  const reservePhoto = thumbnails.some(dish => menuDishPhoto(placeId, dish));
  const openInfo = () => setInfo(true);
  const cardWidth = Math.min(Math.round(width * 0.62), 244);
  const notice = <DataLoadNotice loading={menu.loading && !dishes.length} failed={menu.failed} onRetry={menu.reload} />;
  const empty = !dishes.length && !menu.loading && !menu.failed
    ? <Text style={{ ...preset.body, color: colors.text.secondary }}>{t("place.menu_empty_title")}</Text> : null;
  return <View testID="place-native-menu">
    {onOpenMenu ? <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text accessibilityRole="header" style={{ ...preset.h1, flex: 1, color: colors.chat.djidji }}>{t("menu_detail.preview")}</Text>
        <InfoButton open={openInfo} />
      </View>
      {notice}{empty}
      {!!thumbnails.length && <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + spacing.sm} decelerationRate="fast"
          contentContainerStyle={{ gap: spacing.sm, alignItems: "stretch" }}>
          {thumbnails.map(dish => <DishCard key={dish.key} dish={dish} photo={menuDishPhoto(placeId, dish)}
            reservePhoto={reservePhoto} width={cardWidth} open={() => setChosen(dish.key)} />)}
        </ScrollView>
        <Pressable testID="open-full-menu" accessibilityRole="button" onPress={onOpenMenu}
          style={{ minHeight: 44, alignSelf: "flex-start", paddingHorizontal: spacing.base, flexDirection: "row", alignItems: "center",
            gap: spacing.md, backgroundColor: colors.chat.djidji, borderRadius: radius.full }}>
          <Text style={{ ...preset.small, fontFamily: "Gotham-Bold", color: colors.text.inverse }}>{t("menu_detail.full")}</Text>
          <Ico name="arrow-right" size={17} color={colors.text.inverse} />
        </Pressable>
      </>}
    </View> : <View style={{ borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface.subtle }}>
      <MenuCover placeName={placeName} locationLabel={locationLabel} onBackToPlace={onBackToPlace} photo={menuCoverPhoto(placeId, dishes)} onInfo={openInfo} />
      <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md }}>
        {notice}{empty}
        {!!dishes.length && <>
          {families.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {families.map(name => {
              const active = !terms.length && current === name;
              return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={name}
                onPress={() => { setFamily(name); setQuery(""); }} style={{ minHeight: 44, paddingHorizontal: spacing.md, justifyContent: "center",
                  borderRadius: radius.full, backgroundColor: active ? colors.chat.djidji : "transparent" }}>
                <Text style={{ ...preset.small, fontFamily: "Gotham-Bold", color: active ? colors.text.inverse : colors.chat.djidji }}>{name || t("menu_detail.other")}</Text>
              </Pressable>;
            })}
          </ScrollView>}
          {dishes.length > 6 && <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.sm,
            backgroundColor: colors.surface.raised, borderWidth: 1, borderColor: colors.border.strong, borderRadius: radius.md }}>
            <Ico name="search" size={17} color={colors.chat.djidji} />
            <TextInput accessibilityLabel={t("menu_detail.search")} placeholder={t("menu_detail.search")} value={query} onChangeText={setQuery}
              autoCorrect={false} returnKeyType="search" placeholderTextColor={colors.text.secondary}
              style={{ ...preset.body, flex: 1, minWidth: 0, minHeight: 44, color: colors.text.primary, padding: 0 }} />
          </View>}
          {[...groups].map(([title, entries]) => <View key={title}>
            {title ? <View style={{ borderBottomWidth: 2, borderBottomColor: colors.chat.djidji, paddingVertical: spacing.sm }}>
              <Text accessibilityRole="header" style={{ ...preset.h1, color: colors.chat.djidji }}>{title}</Text>
            </View> : null}
            {entries.map(dish => <DishCard key={dish.key} dish={dish} photo={menuDishPhoto(placeId, dish)} open={() => setChosen(dish.key)} />)}
          </View>)}
          {!groups.size && <Text style={{ ...preset.body, color: colors.text.secondary }}>{t("menu_detail.no_results")}</Text>}
        </>}
      </View>
    </View>}
    {selected && <DishSheet dish={selected} photo={menuDishPhoto(placeId, selected)} close={() => setChosen(null)} />}
    {info && <Modal visible transparent animationType="fade" onRequestClose={() => setInfo(false)}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay.modal }}>
        <SafeAreaView style={{ maxHeight: "85%", backgroundColor: colors.surface.raised, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <Text accessibilityRole="header" style={{ ...preset.h2, color: colors.text.primary }}>{t("menu_detail.info")}</Text>
          <ScrollView>{sources.length ? sources.map(s => <Text key={s} style={{ ...preset.body, color: colors.text.secondary, marginBottom: spacing.sm }}>{s}</Text>)
            : <Text style={{ ...preset.body, color: colors.text.secondary }}>{t("menu_detail.no_metadata")}</Text>}
            {placeId === inMenuId && <Text style={{ ...preset.small, color: colors.text.secondary }}>{t("menu_detail.photo_credit", { credit: "IN’ Concept Store · Brunch" })}</Text>}
            {localMenuPhotography && placeId === leChaMenuId && dishes.some(d => d.photoUrl?.includes("eda-dostavka.com")) && <Text style={{ ...preset.small, color: colors.text.secondary }}>{t("menu_detail.photo_credit", { credit: previewPhotoCredit })}</Text>}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setInfo(false)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...preset.body, color: colors.brand.accent }}>{t("common.close")}</Text></Pressable>
        </SafeAreaView>
      </View>
    </Modal>}
  </View>;
}

