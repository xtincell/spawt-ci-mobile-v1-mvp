// Story 3.5 — Écran de recherche (modal au root, hors (tabs)).
// Recherche client-side : query + filtres AND. Debounce 800ms sur query
// pour `search_submitted`. Tap résultat → fiche lieu avec ref="search".

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { useSpawterStore } from "../src/store/spawter-store";
import { listPlaces, type PlaceWithAdn } from "../src/lib/data-source";
import {
  searchPlaces,
  EMPTY_FILTERS,
  isFiltersEmpty,
  type SearchFilters,
} from "../src/lib/search";
import { SearchBar } from "../src/components/SearchBar";
import { FilterChips, type FilterKind } from "../src/components/FilterChips";
import { FilterSheet } from "../src/components/FilterSheet";
import { ListeCard } from "../src/components/ListeCard";
import { EmptyState } from "../src/components/EmptyState";
import { Ico } from "../src/components/primitives/Ico";
import { Chip } from "../src/components/primitives/Chip";
import { chatKey } from "../src/lib/chat-voice";
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
} from "../src/lib/storage";
import { track } from "../src/lib/analytics";
import { useSpawterPosition } from "../src/lib/use-spawter-position";
import { isPlaceLocked } from "../src/lib/paywall-geo";
import { isGoldSpawter } from "../src/lib/spawter-gold";
import { useFlag } from "../src/store/feature-flags";
import { GoldUpsellSheet } from "../src/components/GoldUpsellSheet";

const SEARCH_DEBOUNCE_MS = 800;

const POPULAR_CUISINES = [
  "ivoirienne",
  "ouest_africaine",
  "francaise",
  "libanaise",
  "fusion",
  "patisserie",
];

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const spawter = useSpawterStore((s) => s.spawter);
  const stade = spawter?.stade ?? "touriste";

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [places, setPlaces] = useState<PlaceWithAdn[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  const lastSubmittedRef = useRef<{ query: string; filters: SearchFilters } | null>(
    null,
  );

  // Charge places + récents au mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [all, r] = await Promise.all([listPlaces(), getRecentSearches()]);
      if (!cancelled) {
        setPlaces(all);
        setRecents(r);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const position = useSpawterPosition();
  const ctx = useMemo(
    () => ({ spawter_lat: position.lat, spawter_lng: position.lng }),
    [position],
  );

  const results = useMemo(
    () => searchPlaces(places, query, filters, ctx),
    [places, query, filters, ctx],
  );

  // Debounce search_submitted event.
  useEffect(() => {
    if (query.length === 0 && isFiltersEmpty(filters)) return;
    const timer = setTimeout(() => {
      const last = lastSubmittedRef.current;
      if (
        last &&
        last.query === query &&
        JSON.stringify(last.filters) === JSON.stringify(filters)
      ) {
        return;
      }
      lastSubmittedRef.current = { query, filters };
      track({
        name: "search_submitted",
        properties: {
          query,
          filters,
          results_count: results.length,
        },
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, filters, results.length]);

  const handleToggle = (kind: FilterKind, value: unknown) => {
    setFilters((prev) => {
      switch (kind) {
        case "cuisine": {
          const c = value as string;
          return {
            ...prev,
            cuisines: prev.cuisines.includes(c)
              ? prev.cuisines.filter((x) => x !== c)
              : [...prev.cuisines, c],
          };
        }
        case "budget": {
          const tier = value as 1 | 2 | 3;
          return {
            ...prev,
            budgetTiers: prev.budgetTiers.includes(tier)
              ? prev.budgetTiers.filter((x) => x !== tier)
              : [...prev.budgetTiers, tier],
          };
        }
        case "distance":
          return { ...prev, distanceKm: value as number | null };
        case "rating":
          return { ...prev, minRating: value as number | null };
      }
    });
    track({
      name: "filter_applied",
      properties: { filter_kind: kind, value },
    });
  };

  // Phase 2 F14 — paywall géographique (nudge, flag OFF par défaut).
  const paywallEnabled = useFlag("paywall-geo");
  const isGold = spawter ? isGoldSpawter(spawter) : false;
  const [upsellVisible, setUpsellVisible] = useState(false);

  const onResultPress = (place: PlaceWithAdn) => {
    if (
      isPlaceLocked({
        paywallEnabled,
        isGold,
        positionSource: position.source,
        spawterLat: position.lat,
        spawterLng: position.lng,
        placeLat: place.location.lat,
        placeLng: place.location.lng,
      })
    ) {
      track({
        name: "paywall_shown",
        properties: { place_id: place.id, surface: "search" },
      });
      setUpsellVisible(true);
      return;
    }
    void addRecentSearch(query).then(async () => {
      const r = await getRecentSearches();
      setRecents(r);
    });
    router.push({
      pathname: "/place/[id]",
      params: { id: place.id, ref: "search" },
    });
  };

  const showEmptyState = query.length === 0 && isFiltersEmpty(filters);
  // `search_suggestions` est un ChatMoment canonique (chat-voice.ts) — passe
  // donc par `chatKey()` plutôt que de hand-construire la clé i18n, ce qui
  // évitait l'abstraction et bypassait `isChatSilent` au stade guide.
  const searchSuggestion = t(chatKey("search_suggestions", stade), {
    defaultValue: "",
  });

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
          gap: theme.spacing.sm,
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
        <View style={{ flex: 1 }}>
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t("search.placeholder")}
            autoFocus
          />
        </View>
      </View>

      <View style={{ paddingVertical: theme.spacing.sm }}>
        <FilterChips
          filters={filters}
          onToggle={handleToggle}
          onOpenSheet={() => setSheetVisible(true)}
        />
      </View>

      {showEmptyState ? (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
        >
          {recents.length > 0 ? (
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: theme.spacing.sm,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.h3,
                    color: theme.colors.text.primary,
                  }}
                >
                  {t("search.empty_recents_title")}
                </Text>
                <Pressable
                  onPress={() => {
                    void clearRecentSearches().then(() => setRecents([]));
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={{
                      ...theme.typography.preset.small,
                      color: theme.colors.brand.accent,
                    }}
                  >
                    {t("search.empty_recents_clear")}
                  </Text>
                </Pressable>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: theme.spacing.sm,
                }}
              >
                {recents.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    variant="outline"
                    onPress={() => setQuery(r)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {searchSuggestion.length > 0 ? (
            <View>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {t("search.empty_suggestions_title")}
              </Text>
              <Text
                style={{
                  ...theme.typography.preset.body,
                  color: theme.colors.text.secondary,
                }}
              >
                {searchSuggestion}
              </Text>
            </View>
          ) : null}

          <View>
            <Text
              style={{
                ...theme.typography.preset.h3,
                color: theme.colors.text.primary,
                marginBottom: theme.spacing.sm,
              }}
            >
              {t("search.empty_cuisines_title")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: theme.spacing.sm,
              }}
            >
              {POPULAR_CUISINES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  variant="outline"
                  onPress={() => handleToggle("cuisine", c)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : results.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("search.results_empty_title")}
          body={t("search.results_empty_body")}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: theme.spacing["2xl"] }}
          renderItem={({ item }) => (
            <ListeCard place={item} onPress={() => onResultPress(item)} />
          )}
        />
      )}

      <FilterSheet
        visible={sheetVisible}
        initialFilters={filters}
        resultsCount={(f) => searchPlaces(places, query, f, ctx).length}
        onApply={(f) => {
          setFilters(f);
          setSheetVisible(false);
          track({
            name: "filter_applied",
            properties: { filter_kind: "sheet_apply", value: f },
          });
        }}
        onClose={() => setSheetVisible(false)}
      />
      <GoldUpsellSheet
        visible={upsellVisible}
        onClose={() => setUpsellVisible(false)}
      />
    </SafeAreaView>
  );
}
