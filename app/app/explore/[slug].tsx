// Mode Explore — détail d'un carnet éditorial (feature post-MVP #3).
//
// Items ordonnés par sort_order : le mot du Chat (editorial_text, filet Or)
// au-dessus de la carte lieu canonique (PlaceCard — photo, nom, quartier,
// score de matching, distance). Tap carte → fiche lieu (ref=explore).
// Les scores viennent du MÊME moteur que le feed (rankPlaces) mais l'ordre
// affiché reste l'ordre ÉDITORIAL — le carnet est une narration, pas un
// feed re-trié.
//
// Même gate que explore.tsx : flag `mode-explore` off → Redirect feed
// (défense en profondeur pour les deep links directs vers un slug).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../src/theme/ThemeProvider";
import { EmptyState } from "../../src/components/EmptyState";
import { PlaceCard } from "../../src/components/PlaceCard";
import { Ico } from "../../src/components/primitives/Ico";
import {
  getExploreCollection,
  type ExploreCollectionDetail,
  type ExploreItem,
} from "../../src/lib/data-source";
import { rankPlaces } from "../../src/lib/matching";
import { track } from "../../src/lib/analytics";
import { useSpawterPosition } from "../../src/lib/use-spawter-position";
import { useSpawterStore } from "../../src/store/spawter-store";
import { useFlag } from "../../src/store/feature-flags";
import { EMPTY_PALAIS } from "../../src/data/seed/sample-spawter";

export default function ExploreCollectionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";

  // Tous les hooks AVANT tout early return (leçon R22 — rules of hooks).
  const enabled = useFlag("mode-explore");
  const position = useSpawterPosition();
  const palais = useSpawterStore((s) => s.palais ?? EMPTY_PALAIS);
  const spawts = useSpawterStore((s) => s.spawts);
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);

  // null = introuvable/dépublié, undefined = chargement en cours.
  const [detail, setDetail] = useState<ExploreCollectionDetail | null | undefined>(
    undefined,
  );
  const openedTrackedRef = useRef(false);

  useEffect(() => {
    if (!enabled || slug.length === 0) return;
    let cancelled = false;
    void (async () => {
      const data = await getExploreCollection(slug);
      if (cancelled) return;
      setDetail(data);
      if (data && !openedTrackedRef.current) {
        openedTrackedRef.current = true;
        track({
          name: "explore_collection_opened",
          properties: { slug: data.slug, items_count: data.items.length },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, slug]);

  // Scores de matching du moteur canonique, indexés par place_id — l'ordre
  // affiché reste celui du carnet (sort_order), seuls les chiffres viennent
  // de rankPlaces.
  const scoresByPlaceId = useMemo(() => {
    const map = new Map<string, { match_score: number; distance_km: number }>();
    if (!detail) return map;
    const scored = rankPlaces(
      {
        spawter_palais: palais,
        spawter_lat: position.lat,
        spawter_lng: position.lng,
        visited_place_ids: new Set(
          spawts.filter((s) => s.is_verified).map((s) => s.place_id),
        ),
        saved_place_ids: savedPlaceIds,
        now: new Date(),
      },
      detail.items.map((i) => ({ place: i.place, adn: i.place.adn, last_spawt_at: null })),
    );
    for (const s of scored) {
      map.set(s.place.id, {
        match_score: s.match_score,
        distance_km: s.distance_km,
      });
    }
    return map;
  }, [detail, palais, position, spawts, savedPlaceIds]);

  if (!enabled) {
    return <Redirect href="/(tabs)" />;
  }

  const onItemPress = (item: ExploreItem) => {
    track({
      name: "explore_item_clicked",
      properties: {
        place_id: item.place.id,
        slug,
        position: detail?.items.findIndex((i) => i.id === item.id) ?? -1,
      },
    });
    router.push({
      pathname: "/place/[id]",
      params: { id: item.place.id, ref: "explore" },
    });
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.base,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <Ico name="arrow-left" size={22} />
        </Pressable>
        {detail ? (
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: theme.colors.brand.primary,
              }}
            >
              {t("explore.kicker")}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.h1,
                color: theme.colors.text.primary,
              }}
              numberOfLines={2}
            >
              {t(detail.title_key)}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.tertiary,
              }}
            >
              {t("explore.items_count", { count: detail.items.length })}
            </Text>
          </View>
        ) : null}
      </View>

      {detail === undefined ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      ) : detail === null ? (
        <EmptyState
          title={t("explore.not_found_title")}
          body={t("explore.not_found_body")}
          cta={{
            label: t("explore.back_to_collections"),
            onPress: () => router.back(),
          }}
        />
      ) : (
        <FlatList
          data={detail.items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing["2xl"],
          }}
          renderItem={({ item }) => {
            const score = scoresByPlaceId.get(item.place.id);
            return (
              <View style={{ marginBottom: theme.spacing.lg }}>
                {item.editorial_text ? (
                  // Le mot du Chat — filet Or à gauche, voix éditoriale.
                  <View
                    style={{
                      borderLeftWidth: 2,
                      borderLeftColor: theme.colors.brand.primary,
                      paddingLeft: theme.spacing.base,
                      marginBottom: theme.spacing.sm,
                    }}
                  >
                    <Text
                      style={{
                        ...theme.typography.preset.body,
                        color: theme.colors.text.secondary,
                        fontStyle: "italic",
                      }}
                    >
                      {item.editorial_text}
                    </Text>
                  </View>
                ) : null}
                <PlaceCard
                  place={item.place}
                  matchScore={score?.match_score ?? 50}
                  distanceKm={score?.distance_km ?? Number.NaN}
                  onPress={() => onItemPress(item)}
                />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
