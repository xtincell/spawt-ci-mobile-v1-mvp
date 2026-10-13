// Story 3.3c — HomeD canonique (UX spec §1119-1156).
// Editorial selection and personalized feed are independent.
// Consomme rankPlaces (Story 3.3b) + listPlaces durci Zod (Story 3.3a) + saved_place_ids (Story 3.6).
// Events analytics : feed_viewed, feed_card_impressed, feed_card_clicked, feed_refreshed, feed_first_view.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  Text,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { usePlaces } from "../../src/lib/use-places";
import { DataLoadNotice } from "../../src/components/DataLoadNotice";
import { useTheme } from "../../src/theme/ThemeProvider";
import { DataSourceBanner } from "../../src/components/DataSourceBanner";
import { EmptyState } from "../../src/components/EmptyState";
import { Masthead } from "../../src/components/Masthead";
import { ModeStories, type ModeKey } from "../../src/components/ModeStories";
import { RapideContent } from "../../src/components/RapideContent";
import { SpotsMap } from "../../src/components/SpotsMap";
import {
  ExploreCollections,
  DuoEditorial,
} from "../../src/components/ExploreCollections";
import { useNavigationAction } from "../../src/lib/use-navigation-action";
import { HomeEditorial } from "../../src/components/HomeEditorial";
import { FeuilletonRow } from "../../src/components/FeuilletonRow";
import { Ico } from "../../src/components/primitives/Ico";
import { listPlaceActivity } from "../../src/lib/data-source";
// Événements & promos (0049/0050) — pastilles par LOT + rangée « Ça bouge
// cette semaine ». Flag `evenements-promos` OFF → aucun fetch, feed identique.
import { EventsWeekRow } from "../../src/components/EventsWeekRow";
import type { PlaceActivityMap } from "../../src/lib/place-activity";
import { rankPlaces, type PlaceWithScore } from "../../src/lib/matching";
import { partitionOpenFirst } from "../../src/lib/opening-hours";
import { useSpawterStore } from "../../src/store/spawter-store";
import { EMPTY_PALAIS } from "../../src/data/seed/sample-spawter";
import { track } from "../../src/lib/analytics";
import { useSpawterPosition } from "../../src/lib/use-spawter-position";
import { isPlaceLocked } from "../../src/lib/paywall-geo";
import { isGoldSpawter } from "../../src/lib/spawter-gold";
import { useFlag } from "../../src/store/feature-flags";
// SPAWT Wrapped — bannière saisonnière (flag `wrapped` + fenêtre déc-janv).
import { WrappedBanner } from "../../src/components/share/WrappedBanner";
import { isWrappedSeason, wrappedYearFor } from "../../src/lib/wrapped";
import { GoldUpsellSheet } from "../../src/components/GoldUpsellSheet";

const FIRST_FEED_KEY = "spawt:hasSeenFirstFeed";

export default function HomeD() {
  const theme = useTheme();
  const router = useRouter();
  const navigate = useNavigationAction();
  const { t } = useTranslation();

  const palais = useSpawterStore((s) => s.palais ?? EMPTY_PALAIS);
  const spawter = useSpawterStore((s) => s.spawter);
  const spawts = useSpawterStore((s) => s.spawts);
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);

  const { places, loading, failed, reload } = usePlaces();
  const refreshing = loading && places.length > 0;
  const [selectedMode, setSelectedMode] = useState<ModeKey>("suggestions");

  const [visitedModes, setVisitedModes] = useState<Set<ModeKey>>(
    () => new Set(["suggestions"]),
  );
  const selectMode = (mode: ModeKey) => {
    if (mode === selectedMode) return;
    setVisitedModes((current) => new Set([...current, mode]));
    setSelectedMode(mode);
  };

  const feedViewedRef = useRef(false);
  const firstViewRef = useRef(false);

  const visited = useMemo(
    () => new Set(spawts.filter((s) => s.is_verified).map((s) => s.place_id)),
    [spawts],
  );

  const position = useSpawterPosition();
  const ctx = useMemo(
    () => ({
      spawter_palais: palais,
      spawter_lat: position.lat,
      spawter_lng: position.lng,
      visited_place_ids: visited,
      saved_place_ids: savedPlaceIds,
      now: new Date(),
    }),
    [palais, position, visited, savedPlaceIds],
  );

  const ranked = useMemo(() => {
    const scored = rankPlaces(
      ctx,
      places.map((p) => ({ place: p, adn: p.adn, last_spawt_at: null })),
    );
    // R20 — les lieux OUVERTS maintenant remontent en tête (l'ordre match est
    // préservé dans chaque groupe — tri stable, cf. opening-hours.ts).
    return partitionOpenFirst(scored, (item) => item.place.hours, ctx.now);
  }, [places, ctx]);

  const [editorialRefresh, setEditorialRefresh] = useState(0);

  // feed_viewed — 1× par mount (dedup via ref).
  useEffect(() => {
    if (loading || failed || feedViewedRef.current) return;
    feedViewedRef.current = true;
    // `top_score` est borné [50, 99] (PRD §8.3). Quand `ranked` est vide on
    // remonte `null` pour que la funnel Kidam ne confonde pas "feed vide"
    // avec "feed avec top_score=0" (impossible vu la borne).
    const topScore = ranked[0]?.match_score ?? null;
    track({
      name: "feed_viewed",
      properties: {
        places_shown: ranked.length,
        top_score: topScore,
        palais_confidence: palais.confidence_score,
      },
    });
  }, [loading, failed, ranked, palais]);

  // feed_first_view — si spawter post-onboarding pre-1er spawt.
  // Gate strict : spawter must exist AND total_spawts === 0. L'ancienne
  // version `spawter?.total_spawts !== 0` était `true` pour spawter undefined
  // (hydrate en cours), ce qui faisait fail-open : l'event se posait sans
  // user identifié. On wait que le store soit hydraté.
  useEffect(() => {
    if (loading || failed || firstViewRef.current) return;
    if (spawter === null) return;
    if (spawter.total_spawts !== 0) return;
    void AsyncStorage.getItem(FIRST_FEED_KEY)
      .then((seen) => {
        if (seen) return;
        // Marque le ref + persist DISK avant de track, pour que deux mounts
        // simultanés (Fast Refresh, double tab switch) ne double-firent pas.
        firstViewRef.current = true;
        return AsyncStorage.setItem(FIRST_FEED_KEY, "1").then(() => {
          track({
            name: "feed_first_view",
            properties: { places_count: ranked.length },
          });
        });
      })
      .catch((err) => {
        if (__DEV__) console.warn("[home] feed_first_view storage failed", err);
      });
  }, [loading, failed, spawter, ranked]);

  const wrappedEnabled = useFlag("wrapped");
  const wrappedSeason = wrappedEnabled && isWrappedSeason();

  // Événements & promos (0049/0050) — pastilles de cartes chargées par LOT :
  // UN aller-retour pour tout le feed (jamais un fetch par carte). Flag OFF →
  // map vide → les cartes rendent strictement comme avant (non-régression).
  // Contrat SPAWT : ces données ÉTIQUETTENT l'affichage, l'ordre du feed
  // (rankPlaces/matching) ne les voit jamais.
  const activityEnabled = useFlag("evenements-promos");
  const [activity, setActivity] = useState<PlaceActivityMap>({});
  useEffect(() => {
    if (!activityEnabled || places.length === 0) {
      setActivity({});
      return;
    }
    let cancelled = false;
    void listPlaceActivity(places.map((p) => p.id))
      .then((map) => {
        if (!cancelled) setActivity(map);
      })
      .catch((err: unknown) => {
        if (__DEV__) console.warn("[home] listPlaceActivity failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [activityEnabled, places]);

  // Phase 2 F14 — paywall géographique (nudge, flag OFF par défaut) :
  // un lieu hors zone gratuite ouvre l'upsell Gold au lieu de la fiche.
  const paywallEnabled = useFlag("paywall-geo");
  const isGold = spawter ? isGoldSpawter(spawter) : false;
  const [upsellVisible, setUpsellVisible] = useState(false);

  const isLocked = (item: PlaceWithScore) =>
    isPlaceLocked({
      paywallEnabled,
      isGold,
      positionSource: position.source,
      spawterLat: position.lat,
      spawterLng: position.lng,
      placeLat: item.place.location.lat,
      placeLng: item.place.location.lng,
    });

  const onUnePress = (item: PlaceWithScore) => {
    if (isLocked(item)) {
      track({
        name: "paywall_shown",
        properties: { place_id: item.place.id, surface: "feed" },
      });
      setUpsellVisible(true);
      return;
    }
    navigate(() => {
      track({
        name: "feed_card_clicked",
        properties: {
          place_id: item.place.id,
          position: ranked.findIndex((r) => r.place.id === item.place.id),
          match_score: item.match_score,
          distance_km: item.distance_km,
        },
      });
      router.push({
        pathname: "/place/[id]",
        params: { id: item.place.id, ref: "feed" },
      });
    });
  };

  const onRefresh = () => {
    track({
      name: "feed_refreshed",
      properties: { places_count: places.length },
    });
    void reload();
    setEditorialRefresh((n) => n + 1);
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <DataSourceBanner />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingRight: theme.spacing.base,
        }}
      >
        <View style={{ flex: 1 }}>
          <Masthead kicker={t("home.masthead_kicker")} />
        </View>
        <Pressable
          // typedRoutes regenerate les types au prochain build — V1 cast.
          onPress={() => router.push("/search" as never)}
          accessibilityRole="button"
          accessibilityLabel={t("search.title")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ico name="search" size={22} />
        </Pressable>
      </View>

      <View
        style={{
          marginTop: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors.surface.editorial,
        }}
      >
        <ModeStories selectedMode={selectedMode} onModePress={selectMode} />
      </View>

      {(["suggestions", "rapide", "selections", "duo", "spots"] as const).map(
        (mode) =>
          visitedModes.has(mode) ? (
            <View
              key={mode}
              testID={`home-panel-${mode}`}
              accessibilityElementsHidden={selectedMode !== mode}
              importantForAccessibility={
                selectedMode === mode ? "auto" : "no-hide-descendants"
              }
              style={{
                flex: 1,
                display: selectedMode === mode ? "flex" : "none",
              }}
            >
              <ScrollView
                nestedScrollEnabled
                testID={`home-scroll-${mode}`}
                refreshControl={
                  mode === "suggestions" ? (
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={theme.colors.brand.primary}
                    />
                  ) : undefined
                }
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingBottom: theme.spacing.lg,
                  backgroundColor:
                    mode === "suggestions"
                      ? theme.colors.surface.base
                      : theme.colors.surface.subtle,
                }}
              >
                {mode !== "rapide" ? (
                  <View
                    style={{
                      padding: theme.spacing.lg,
                      gap: theme.spacing.xs,
                      backgroundColor: theme.colors.surface.subtle,
                    }}
                  >
                    <Text
                      accessibilityRole="header"
                      style={{
                        ...theme.typography.preset.h1,
                        color: theme.colors.text.primary,
                      }}
                    >
                      {t(`home.interfaces.${mode}.title`)}
                    </Text>
                    <Text
                      style={{
                        ...theme.typography.preset.body,
                        color: theme.colors.text.secondary,
                      }}
                    >
                      {t(`home.interfaces.${mode}.subtitle`)}
                    </Text>
                  </View>
                ) : null}
                {mode === "rapide" ? (
                  <RapideContent
                    embedded
                    active={selectedMode === mode}
                    onBack={() => selectMode("suggestions")}
                  />
                ) : null}
                {mode === "selections" ? (
                  <ExploreCollections active={selectedMode === mode} />
                ) : null}
                {mode === "duo" ? <DuoEditorial /> : null}
                {mode === "spots" ? <SpotsMap embedded /> : null}
                {mode === "suggestions" ? (
                  <>
                    <DataLoadNotice
                      loading={loading}
                      failed={failed}
                      onRetry={() => void reload()}
                    />
                    {/* SPAWT Wrapped — bannière saisonnière vers /wrapped. */}
                    {wrappedSeason ? (
                      <View style={{ marginTop: theme.spacing.lg }}>
                        <WrappedBanner
                          year={wrappedYearFor()}
                          onPress={() => router.push("/wrapped" as never)}
                        />
                      </View>
                    ) : null}

                    <HomeEditorial
                      mode="suggestions"
                      ranked={ranked}
                      onPlacePress={onUnePress}
                      refreshKey={editorialRefresh}
                      inventoryPending={loading || failed}
                      activity={activity}
                      onImpression={(item, position) =>
                        track({
                          name: "feed_card_impressed",
                          properties: {
                            place_id: item.place.id,
                            position,
                            match_score: item.match_score,
                          },
                        })
                      }
                    />

                    {/* « Ça bouge cette semaine » — événements à venir (0049), auto-gatée
            par le flag `evenements-promos` (OFF → null, aucun fetch). */}
                    <EventsWeekRow
                      onPlacePress={(placeId) =>
                        router.push({
                          pathname: "/place/[id]",
                          params: { id: placeId, ref: "feed" },
                        })
                      }
                    />

                    {ranked.length > 0 ? (
                      <View
                        testID="home-personalized-feed"
                        style={{ marginTop: theme.spacing.lg }}
                      >
                        <Text
                          accessibilityRole="header"
                          style={{
                            ...theme.typography.preset.h2,
                            color: theme.colors.text.primary,
                            paddingHorizontal: theme.spacing.lg,
                            marginBottom: theme.spacing.sm,
                          }}
                        >
                          {t("home.personalized_feed")}
                        </Text>
                        <FeuilletonRow
                          places={ranked}
                          startIndex={1}
                          onPlacePress={onUnePress}
                          activity={activity}
                        />
                      </View>
                    ) : null}
                    {!loading && !failed && ranked.length === 0 ? (
                      <EmptyState
                        icon="search"
                        title={t("search.results_empty_title")}
                        body={t("search.results_empty_body")}
                      />
                    ) : null}
                  </>
                ) : null}
              </ScrollView>
            </View>
          ) : null,
      )}
      <GoldUpsellSheet
        visible={upsellVisible}
        onClose={() => setUpsellVisible(false)}
      />
    </SafeAreaView>
  );
}
