// Story 3.3c — UneCarousel : carrousel swipeable horizontal des top N Unes.
// FlatList horizontal + dots pagination + viewability tracking.
//
// Snap : on N'utilise PAS `pagingEnabled` car il snap par largeur d'écran
// complète (incompatible avec une card qui fait `screenWidth - 48`), ce qui
// fait diverger iOS et Android. On utilise `snapToInterval` + `decelerationRate`
// pour un snap natif et cohérent cross-OS.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { UneCard } from "./UneCard";
import type { PlaceWithScore } from "../lib/matching";

interface Props {
  unes: readonly PlaceWithScore[];
  onUnePress: (place: PlaceWithScore) => void;
  /** Callback déclenché quand une carte devient visible ≥50% pendant ≥500ms. */
  onImpression?: (place: PlaceWithScore, index: number) => void;
  /** Voir UneCard.props.showMatchScore — caché tant que palais "En construction". */
  showMatchScore?: boolean;
}

export function UneCarousel({
  unes,
  onUnePress,
  onImpression,
  showMatchScore = true,
}: Props) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 48;
  const [activeIndex, setActiveIndex] = useState(0);
  const trackedIdsRef = useRef<Set<string>>(new Set());

  // Reset des impressions trackées quand la liste de unes change (refresh,
  // changement de mode) — sinon une carte revenue à l'affichage après filtrage
  // ne re-déclencherait jamais d'événement impression.
  useEffect(() => {
    trackedIdsRef.current = new Set();
  }, [unes]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;
      const first = viewableItems[0];
      if (typeof first?.index === "number") {
        setActiveIndex(first.index);
      }
      if (!onImpression) return;
      for (const v of viewableItems) {
        const place = (v.item as PlaceWithScore | undefined)?.place;
        if (!place) continue;
        if (typeof v.index !== "number") continue; // ne pas confondre "position inconnue" avec "position 0"
        if (trackedIdsRef.current.has(place.id)) continue;
        trackedIdsRef.current.add(place.id);
        onImpression(v.item as PlaceWithScore, v.index);
      }
    },
    [onImpression],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 500,
  }).current;

  if (unes.length === 0) return null;

  return (
    <View>
      <FlatList
        data={unes as PlaceWithScore[]}
        keyExtractor={(item) => item.place.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={cardWidth + theme.spacing.base}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.base,
        }}
        renderItem={({ item }) => (
          <UneCard
            une={item}
            onPress={() => onUnePress(item)}
            showMatchScore={showMatchScore}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      {unes.length > 1 ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            marginTop: theme.spacing.sm,
            gap: 6,
          }}
        >
          {unes.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === activeIndex ? 12 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i === activeIndex
                    ? theme.colors.text.primary
                    : theme.colors.text.tertiary,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
