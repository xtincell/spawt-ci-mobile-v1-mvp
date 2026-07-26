// Story 3.3c — HomeD canonique (UX spec §1119-1156).
// Refonte du feed : Masthead + ModeStories + UneCarousel + édito ChatBubble + FeuilletonRow.
// Consomme rankPlaces (Story 3.3b) + listPlaces durci Zod (Story 3.3a) + saved_place_ids (Story 3.6).
// Events analytics : feed_viewed, feed_card_impressed, feed_card_clicked, feed_refreshed, feed_first_view.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../src/theme/ThemeProvider";
import { ChatBubble } from "../../src/components/ChatBubble";
import { DataSourceBanner } from "../../src/components/DataSourceBanner";
import { EmptyState } from "../../src/components/EmptyState";
import { Masthead } from "../../src/components/Masthead";
import {
  ModeStories,
  type ModeEntry,
  type ModeKey,
} from "../../src/components/ModeStories";
import { UneCarousel } from "../../src/components/UneCarousel";
import { FeuilletonRow } from "../../src/components/FeuilletonRow";
import { Ico } from "../../src/components/primitives/Ico";
import {
  listPlaces,
  listPlaceActivity,
  type PlaceWithAdn,
} from "../../src/lib/data-source";
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

// Mapping mode → filtre heuristique (Dev Notes §1 Story 3.3c — à ajuster en alpha).
// Le `default:` est un filet anti-régression : si `ModeKey` gagne une valeur
// future ou si un mode invalide se persiste (rehydrate corruption), on
// retourne la liste complète plutôt que `undefined`.
export function applyModeFilter(
  places: readonly PlaceWithAdn[],
  mode: ModeKey | null,
): PlaceWithAdn[] {
  if (mode === null) return [...places];
  switch (mode) {
    case "traine":
      return places.filter(
        (p) => p.price.tier <= 2 && p.adn.axe_decontracte_habille < 0,
      );
    case "decouvre":
      return places.filter(
        (p) =>
          p.adn.axe_populaire_prive > 0 || p.signals.includes("decouverte"),
      );
    case "tribu":
      return places.filter((p) => p.adn.axe_decontracte_habille < 0.2);
    case "chic":
      return places.filter(
        (p) => p.price.tier === 3 || p.adn.axe_decontracte_habille > 0.3,
      );
    case "vite":
      return places.filter((p) => p.adn.axe_informel_etabli < 0);
    default:
      return [...places];
  }
}

export default function HomeD() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const palais = useSpawterStore((s) => s.palais ?? EMPTY_PALAIS);
  const spawter = useSpawterStore((s) => s.spawter);
  const spawts = useSpawterStore((s) => s.spawts);
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);

  const [places, setPlaces] = useState<PlaceWithAdn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ModeKey | null>(null);

  const feedViewedRef = useRef(false);
  const firstViewRef = useRef(false);

  const fetchPlaces = async () => {
    const data = await listPlaces();
    setPlaces(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void fetchPlaces();
  }, []);

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
    const candidates = applyModeFilter(places, selectedMode);
    const scored = rankPlaces(
      ctx,
      candidates.map((p) => ({ place: p, adn: p.adn, last_spawt_at: null })),
    );
    // R20 — les lieux OUVERTS maintenant remontent en tête (l'ordre match est
    // préservé dans chaque groupe — tri stable, cf. opening-hours.ts).
    return partitionOpenFirst(scored, (item) => item.place.hours, ctx.now);
  }, [places, selectedMode, ctx]);

  const top3 = useMemo(() => ranked.slice(0, 3), [ranked]);
  const feuilleton = useMemo(() => ranked.slice(3), [ranked]);

  const stade = spawter?.stade ?? "touriste";

  // feed_viewed — 1× par mount (dedup via ref).
  useEffect(() => {
    if (loading || feedViewedRef.current) return;
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
  }, [loading, ranked, palais]);

  // feed_first_view — si spawter post-onboarding pre-1er spawt.
  // Gate strict : spawter must exist AND total_spawts === 0. L'ancienne
  // version `spawter?.total_spawts !== 0` était `true` pour spawter undefined
  // (hydrate en cours), ce qui faisait fail-open : l'event se posait sans
  // user identifié. On wait que le store soit hydraté.
  useEffect(() => {
    if (loading || firstViewRef.current) return;
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
  }, [loading, spawter, ranked]);

  // Sprint 2 — hub des modes plein écran (post-MVP #1/#3). Flags OFF par
  // défaut → `modeEntries` vide → ModeStories rend EXACTEMENT comme avant
  // (critère de non-régression). Le Mode Crew (chantier parallèle) s'ajoutera
  // ici par le même canal.
  const rapideEnabled = useFlag("mode-rapide");
  const exploreEnabled = useFlag("mode-explore");
  // SPAWT Wrapped — bannière saisonnière (flag `wrapped` OFF par défaut +
  // fenêtre 1er déc → 15 janv). Hors des deux gardes : feed inchangé.
  const wrappedEnabled = useFlag("wrapped");
  const wrappedSeason = wrappedEnabled && isWrappedSeason();
  const modeEntries = useMemo(() => {
    const entries: ModeEntry[] = [];
    if (rapideEnabled) {
      entries.push({
        key: "rapide",
        icon: "arrow-right",
        labelKey: "modes.entry_rapide.label",
        // typedRoutes regenerate les types au prochain build — V1 cast.
        onPress: () => router.push("/rapide" as never),
      });
    }
    if (exploreEnabled) {
      entries.push({
        key: "explore",
        icon: "map",
        labelKey: "modes.entry_explore.label",
        onPress: () => router.push("/explore" as never),
      });
    }
    return entries;
  }, [rapideEnabled, exploreEnabled, router]);

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
  };

  const onImpression = (item: PlaceWithScore, position: number) => {
    track({
      name: "feed_card_impressed",
      properties: {
        place_id: item.place.id,
        position,
        match_score: item.match_score,
      },
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    track({
      name: "feed_refreshed",
      properties: { places_count: places.length },
    });
    void fetchPlaces();
  };

  if (loading) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      >
        <DataSourceBanner />
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (ranked.length === 0 && selectedMode !== null) {
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
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.base,
          }}
        >
          <Masthead kicker={t("home.masthead_kicker")} />
        </View>
        <ModeStories
          selectedMode={selectedMode}
          onModePress={setSelectedMode}
          entries={modeEntries}
        />
        <EmptyState
          icon="search"
          title={t("search.results_empty_title")}
          body={t("search.results_empty_body")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <DataSourceBanner />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: theme.spacing["3xl"] }}
      >
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
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ico name="search" size={22} />
          </Pressable>
        </View>

        <View style={{ marginTop: theme.spacing.sm }}>
          <ModeStories
            selectedMode={selectedMode}
            onModePress={setSelectedMode}
            entries={modeEntries}
          />
        </View>

        {/* SPAWT Wrapped — bannière saisonnière vers /wrapped. */}
        {wrappedSeason ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <WrappedBanner
              year={wrappedYearFor()}
              onPress={() => router.push("/wrapped" as never)}
            />
          </View>
        ) : null}

        {/* R7 — le bloc mascotte précède la sélection des 3 suggestions,
            avec la copy définitive « Voici mes 3 suggestions du jour. » */}
        {top3.length > 0 ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              marginTop: theme.spacing.lg,
            }}
          >
            <ChatBubble
              stade={stade}
              moment="home_edito"
              variant="edito"
              overrideText={t("home.suggestions_title")}
            />
          </View>
        ) : null}

        {top3.length > 0 ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <UneCarousel
              unes={top3}
              onUnePress={onUnePress}
              onImpression={onImpression}
              // Invariant project-context — Palais "En construction" ne
              // produit qu'un score cosine pseudo-aléatoire qu'il ne faut pas
              // exposer en kicker éditorial.
              showMatchScore={palais.confidence_score >= 0.3}
              activity={activity}
            />
          </View>
        ) : null}

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

        {feuilleton.length > 0 ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <FeuilletonRow
              places={feuilleton}
              onPlacePress={onUnePress}
              activity={activity}
            />
          </View>
        ) : null}
      </ScrollView>
      <GoldUpsellSheet
        visible={upsellVisible}
        onClose={() => setUpsellVisible(false)}
      />
    </SafeAreaView>
  );
}
