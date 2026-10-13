import { ExploreCollections, DuoEditorial } from "./ExploreCollections";
import { useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { selectHomeEditorial } from "../lib/home-editorial";
import type { PlaceWithScore } from "../lib/matching";
import type { ModeKey } from "./ModeStories";
import { PlaceCover } from "./PlaceCover";
import type { PlaceActivityMap } from "../lib/place-activity";
import { PlaceActivityPill } from "./PlaceActivityPill";

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
        const card = token.item as { id: string; place?: PlaceWithScore };
        if (!card.place || token.index === null || seen.current.has(card.id))
          continue;
        seen.current.add(card.id);
        report.current?.(card.place, token.index);
      }
    },
  ).current;

  if (mode === "selections")
    return <ExploreCollections refreshKey={refreshKey} />;
  if (mode === "duo") return <DuoEditorial />;
  const cards = places.map((item) => ({
    id: item.place.id,
    title: item.place.name,
    subtitle: item.place.location.neighborhood,
    cover: item.place.cover_photo_url,
    place: item,
    onPress: () => onPlacePress(item),
  }));

  return (
    <View
      testID="home-editorial"
      style={{
        paddingVertical: theme.spacing.base,
        backgroundColor: theme.colors.surface.subtle,
      }}
    >
      {cards.length > 0 ? (
        <FlatList
          key={mode}
          data={cards}
          keyExtractor={(card) => card.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
          snapToInterval={width - 56}
          decelerationRate="fast"
          viewabilityConfig={viewability}
          onViewableItemsChanged={onVisible}
          renderItem={({ item }) => (
            <EditorialCard {...item} width={width - 64} activity={activity} />
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

function EditorialCard({
  title,
  subtitle,
  cover,
  onPress,
  width,
  place,
  activity,
}: {
  title: string;
  subtitle: string;
  cover: string | null | undefined;
  onPress: () => void;
  width: number;
  place?: PlaceWithScore | undefined;
  activity?: PlaceActivityMap | undefined;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => ({
        width,
        borderRadius: theme.radius.card,
        overflow: "hidden",
        backgroundColor: theme.colors.surface.raised,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <PlaceCover uri={cover} style={{ width: "100%", height: 120 }} />
      <View style={{ padding: theme.spacing.md, gap: 3 }}>
        {place && activity?.[place.place.id] ? (
          <PlaceActivityPill activity={activity[place.place.id]!} />
        ) : null}
        <Text
          style={{
            ...theme.typography.preset.h2,
            color: theme.colors.text.primary,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.secondary,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
