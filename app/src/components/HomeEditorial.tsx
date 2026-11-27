import { useFlag } from "../store/feature-flags";
import { ExploreCollections, DuoEditorial } from "./ExploreCollections";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { selectHomeEditorial } from "../lib/home-editorial";
import { getPlaceBudgetLabel } from "../lib/format-price";
import type { PlaceWithScore } from "../lib/matching";
import type { ModeKey } from "./ModeStories";
import { Ico } from "./primitives/Ico";
import type { PlaceActivityMap } from "../lib/place-activity";
import { PlaceActivityPill } from "./PlaceActivityPill";
import { OutingActions } from "./OutingActions";

export function HomeEditorial({
  mode,
  ranked,
  onPlacePress,
  onImpression,
  activity,
  inventoryPending = false,
  refreshKey = 0,
}: {
  mode: ModeKey;
  ranked: readonly PlaceWithScore[];
  onPlacePress: (item: PlaceWithScore) => void;
  refreshKey?: number;
  inventoryPending?: boolean;
  onImpression?: (item: PlaceWithScore, index: number) => void;
  activity?: PlaceActivityMap;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const places = useMemo(
    () => selectHomeEditorial(ranked, mode),
    [ranked, mode],
  );
  const report = useRef(onImpression);
  report.current = onImpression;
  const seen = useRef(new Set<string>());
  useEffect(() => {
    seen.current.clear();
  }, [mode, ranked]);
  const viewability = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500,
  }).current;
  const onVisible = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      for (const token of viewableItems) {
        const card = token.item as PlaceWithScore;
        if (!card?.place || token.index === null || seen.current.has(card.place.id))
          continue;
        seen.current.add(card.place.id);
        report.current?.(card, token.index);
      }
    },
  ).current;

  if (mode === "selections")
    return <ExploreCollections refreshKey={refreshKey} />;
  if (mode === "duo") return <DuoEditorial refreshKey={refreshKey} />;
  const cardWidth = Math.min(width - theme.spacing.base * 2 - theme.spacing.md, 440);

  return (
    <View
      testID="home-editorial"
      style={{
        paddingBottom: theme.spacing.lg,
        backgroundColor: theme.colors.surface.subtle,
      }}
    >
      {places.length > 0 ? (
        <FlatList
          key={mode}
          data={places}
          keyExtractor={(item) => item.place.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.base,
            gap: theme.spacing.md,
          }}
          snapToInterval={cardWidth + theme.spacing.md}
          decelerationRate="fast"
          viewabilityConfig={viewability}
          onViewableItemsChanged={onVisible}
          renderItem={({ item, index }) => (
            <View style={{
              width: cardWidth, overflow: "hidden", borderRadius: theme.radius.card,
              backgroundColor: theme.colors.surface.raised,
              borderWidth: 1, borderColor: theme.colors.border.subtle,
            }}>
              <EditorialCard item={item} index={index} activity={activity} onPress={() => onPlacePress(item)} />
              <OutingActions placeId={item.place.id} onHomeCard />
            </View>
          )}
        />
      ) : !inventoryPending ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
          }}
        >
          {t("home.editorial_empty")}
        </Text>
      ) : null}
    </View>
  );
}

function EditorialCard({ item, index, onPress, activity }: {
  item: PlaceWithScore;
  index: number;
  onPress: () => void;
  activity?: PlaceActivityMap | undefined;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { place, adn } = item;
  const monetaryBudget = useFlag("place-avg-price");
  const cover = place.cover_photo_url?.trim();
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const hasPhoto = Boolean(cover && cover !== failedCover);
  const { primary: ink, secondary } = theme.colors.text;
  const accent = theme.colors.brand.accent;
  const neighborhood = place.location.neighborhood?.trim() || place.location.city?.trim();
  const cuisines = place.cuisine.filter(code => code !== "autre").slice(0,2)
    .map(code => t(`cuisine.${code}`, { defaultValue: code.replace(/_/g, " ") })).join(" · ");
  const budget = getPlaceBudgetLabel(place.price, t, monetaryBudget);
  const publicCount = adn.total_reviews;
  const rated = Number.isInteger(publicCount) && publicCount > 0 &&
    Number.isFinite(adn.weighted_rating) && adn.weighted_rating >= 1 && adn.weighted_rating <= 5;
  const score = rated ? adn.weighted_rating.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "/5" : null;
  const reviews = rated ? t("place.bande_review_count", { count: publicCount }) : null;
  const flags = activity?.[place.id];
  const label = [
    place.name, cuisines, neighborhood, budget, score, reviews,
    flags?.has_promo && t("place_activity.pill_promo"), flags?.has_event && t("place_activity.pill_event"),
  ].filter(Boolean).join(", ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexGrow: 1, backgroundColor: theme.colors.surface.raised, opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: "100%", aspectRatio: 1.65, overflow: "hidden" }}>
        {hasPhoto && cover ? (
          <Image
            source={{ uri: cover }}
            onError={() => setFailedCover(cover)}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
            accessible={false}
          />
        ) : <EditorialArtwork alternate={index % 2 !== 0} />}
        {flags?.has_event || flags?.has_promo ? (
          <View style={{
            position: "absolute", top: theme.spacing.md, left: theme.spacing.md,
            backgroundColor: theme.colors.surface.raised, borderRadius: theme.radius.full,
            padding: theme.spacing.xs,
          }}>
            <PlaceActivityPill activity={flags} />
          </View>
        ) : null}
      </View>
      <View style={{ flexGrow: 1, padding: theme.spacing.base, gap: theme.spacing.sm }}>
        {cuisines ? (
          <Text style={{ ...theme.typography.preset.caption, color: accent }}>{cuisines}</Text>
        ) : null}
        <Text style={{ ...theme.typography.preset.h1, color: ink }}>
          {place.name}
        </Text>
        {neighborhood ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
            <Ico name="pin" size={15} color={accent} />
            <Text style={{ ...theme.typography.preset.body, color: secondary, flexShrink: 1 }}>{neighborhood}</Text>
          </View>
        ) : null}
        <Text style={{ ...theme.typography.preset.data, color: accent }}>{budget}</Text>
        {score ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.xs }}>
            <Ico name="star" size={16} color={accent} filled />
            <Text style={{ ...theme.typography.preset.data, color: ink }}>{score}</Text>
            <Text style={{ ...theme.typography.preset.small, color: secondary }}>{reviews}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function EditorialArtwork({ alternate }: { alternate: boolean }) {
  const { colors } = useTheme();
  const mark = alternate
    ? require("../../assets/brand/logo-icon.png")
    : require("../../assets/brand/logo-map-icon.png");
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        flex: 1, alignItems: "center", justifyContent: "center",
        backgroundColor: alternate ? colors.chat.djidji : colors.brand.accent,
      }}
    >
      <Svg
        viewBox="0 0 330 200" preserveAspectRatio="xMidYMid slice"
        width="100%" height="100%" style={{ position: "absolute" }} accessible={false}
      >
        <Path
          d="M-24 48C37 53 41 10 75-12 M-24 64C48 65 48 22 93-12 M-24 81C65 78 59 37 113-12 M-24 100C77 91 74 47 134-12 M209 213C247 180 229 143 278 130S334 110 365 65 M228 213C265 183 248 156 288 144S347 123 365 94 M249 213C280 186 268 166 300 159S352 139 365 123 M274 213C300 192 289 179 315 174S351 162 365 149"
          fill="none" stroke={colors.text.inverseSecondary} strokeWidth={1.2} opacity={0.45}
        />
        <Path
          d="M-12 159Q51 143 73 114T108 64 M234-14Q199 22 211 47T268 80Q305 84 348 34"
          fill="none" stroke={colors.text.inverseSecondary} strokeWidth={1}
          strokeDasharray="3 6" opacity={0.32}
        />
      </Svg>
      <Image source={mark} resizeMode="contain" accessible={false} style={{ width: "63%", height: "76%" }} />
    </View>
  );
}
