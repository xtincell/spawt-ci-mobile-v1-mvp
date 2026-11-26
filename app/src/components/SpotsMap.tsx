import { requireOptionalNativeModule } from "expo";
import { useNavigationAction } from "../lib/use-navigation-action";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { FeatureCollection, Point } from "geojson";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlaces } from "../lib/use-places";
import { useTheme } from "../theme/ThemeProvider";
import { DataSourceBanner } from "./DataSourceBanner";
import { Ico } from "./primitives/Ico";
import type { PlaceWithAdn } from "../lib/data-source";
import { useSpawterPosition } from "../lib/use-spawter-position";
import { track } from "../lib/analytics";
import {
  hasPlaceCoordinates,
  exploredPlaceIds,
  isMapCoordinate,
} from "../lib/place-discovery";
import { ABIDJAN_FALLBACK, getActiveCity } from "../lib/city";
import { haversineKm } from "../lib/matching";
import { useSpawterStore } from "../store/spawter-store";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const DEFAULT_ZOOM = 11.5;

type MapLibreModule = typeof import("@maplibre/maplibre-react-native");
type PlacePoints = FeatureCollection<
  Point,
  { placeId: string; name: string; explored: boolean }
>;

/** A tab can remain mounted behind another screen. Only its visible instance owns a GPU surface. */
function useVisibleMap() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(
    () => !AppState.currentState || AppState.currentState === "active",
  );
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  return focused && foreground;
}

export function SpotsMap({ embedded = false }: { embedded?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const navigate = useNavigationAction();
  const Container = embedded ? View : SafeAreaView;
  const { t } = useTranslation();
  const position = useSpawterPosition();

  const [maplibre, setMaplibre] = useState<MapLibreModule | null>(null);
  const [moduleFailed, setModuleFailed] = useState(false);
  const [styleFailed, setStyleFailed] = useState(false);
  const visible = useVisibleMap();
  const { places, loading, failed, reload } = usePlaces();
  const spawts = useSpawterStore((s) => s.spawts);
  const spawterId = useSpawterStore((s) => s.spawter?.id);
  const explored = useMemo(
    () => exploredPlaceIds(spawts, spawterId),
    [spawts, spawterId],
  );
  const [filter, setFilter] = useState<"all" | "unexplored" | "mine">("all");
  const [listMode, setListMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visiblePlaces = useMemo(
    () =>
      places.filter(
        (place) =>
          place.is_published &&
          (filter === "all" ||
            (filter === "mine"
              ? explored.has(place.id)
              : !explored.has(place.id))),
      ),
    [places, filter, explored],
  );
  const locatedPlaces = useMemo(
    () => visiblePlaces.filter(hasPlaceCoordinates),
    [visiblePlaces],
  );
  const selected = locatedPlaces.find((place) => place.id === selectedId);
  const points = useMemo<PlacePoints>(
    () => ({
      type: "FeatureCollection",
      features: locatedPlaces.map((place) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [place.location.lng, place.location.lat],
        },
        properties: {
          placeId: place.id,
          name: place.name,
          explored: explored.has(place.id),
        },
      })),
    }),
    [locatedPlaces, explored],
  );
  const trackedOpen = useRef(false);

  // Chargement dynamique du module natif — fallback si absent (Expo Go / web).
  useEffect(() => {
    if (!visible || maplibre || moduleFailed) return;
    let cancelled = false;
    void (async () => {
      try {
        if (Platform.OS === "web") throw new Error("Native map unavailable");
        if (Platform.OS === "android") {
          const capability = requireOptionalNativeModule<{
            canRenderAsync(): Promise<boolean>;
          }>("SpawtMapCapabilities");
          if (!(await capability?.canRenderAsync())) {
            if (!cancelled) setModuleFailed(true);
            return;
          }
        }
        if (cancelled) return;
        const mod = await import("@maplibre/maplibre-react-native");
        if (!cancelled) setMaplibre(mod);
      } catch {
        if (!cancelled) setModuleFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, maplibre, moduleFailed]);

  useEffect(() => {
    if (trackedOpen.current) return;
    trackedOpen.current = true;
    track({ name: "feed_viewed", properties: { surface: "carte" } });
  }, []);

  const openPlace = useCallback(
    (place_id: string) => {
      navigate(() => {
        track({
          name: "feed_card_clicked",
          properties: { place_id, surface: "carte" },
        });
        router.push(`/place/${place_id}`);
      });
    },
    [router, navigate],
  );

  const city = getActiveCity();
  const center = useMemo<[number, number]>(() => {
    const home = isMapCoordinate(city.default_lat, city.default_lng)
      ? city
      : ABIDJAN_FALLBACK;
    // Keep the Abidjan catalogue in view when a visitor opens SPAWT from another city.
    if (
      position.source === "gps" &&
      isMapCoordinate(position.lat, position.lng) &&
      haversineKm(
        home.default_lat,
        home.default_lng,
        position.lat,
        position.lng,
      ) < 35
    ) {
      return [position.lng, position.lat];
    }
    return [home.default_lng, home.default_lat];
  }, [city, position.source, position.lat, position.lng]);
  const reportStyleFailure = useCallback(() => setStyleFailed(true), []);
  const showList = moduleFailed || listMode || styleFailed;
  function toggleView() {
    setSelectedId(null);
    if (styleFailed) {
      setStyleFailed(false);
      setListMode(false);
    } else setListMode((value) => !value);
  }

  const { colors, spacing, radius, typography } = theme;
  const loadingInventory = loading && !places.length;
  const hasInventory = places.length > 0 || (!loading && !failed);
  const noResults =
    hasInventory && !loading && !failed && !visiblePlaces.length;
  const noMappedPlaces =
    !showList && visiblePlaces.length > 0 && !locatedPlaces.length;
  const controls = (
    <View
      style={{
        backgroundColor: colors.surface.base,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border.strong,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.base,
        }}
      >
        <Image
          source={require("../../assets/brand/logo-map-icon.png")}
          resizeMode="contain"
          accessible={false}
          style={{ width: 32, height: 42 }}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            style={{ ...typography.preset.h1, color: colors.text.primary }}
          >
            {city.name}
          </Text>
          {hasInventory ? (
            <Text
              testID="carte-inventory-count"
              style={{
                ...typography.preset.small,
                color: colors.text.secondary,
              }}
            >
              {t("carte.inventory_count", {
                total: visiblePlaces.length,
                mapped: locatedPlaces.length,
              })}
            </Text>
          ) : loadingInventory ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                ...typography.preset.small,
                color: colors.text.secondary,
              }}
            >
              {t("carte.loading_places")}
            </Text>
          ) : null}
        </View>
        {!moduleFailed && (
          <Pressable
            testID="carte-view-toggle"
            accessibilityRole="button"
            accessibilityLabel={t(
              showList ? "carte.show_map" : "carte.show_list",
            )}
            onPress={toggleView}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              borderRadius: radius.full,
              backgroundColor: colors.surface.editorial,
              borderWidth: 1,
              borderColor: colors.border.strong,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ico
              name={showList ? "map" : "compass"}
              size={17}
              color={colors.brand.accent}
            />
            <Text
              style={{ ...typography.preset.small, color: colors.text.primary }}
            >
              {t(showList ? "carte.show_map" : "carte.show_list")}
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginTop: spacing.xs }}
        contentContainerStyle={{
          gap: spacing.sm,
          paddingHorizontal: spacing.base,
        }}
        accessibilityRole="radiogroup"
      >
        {(["all", "unexplored", "mine"] as const).map((value) => {
          const active = filter === value;
          return (
            <Pressable
              key={value}
              testID={`carte-filter-${value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                setFilter(value);
                setSelectedId(null);
              }}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: "center",
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: active
                    ? colors.brand.accent
                    : colors.surface.subtle,
                }}
              >
                {active && (
                  <Ico name="check" size={13} color={colors.text.inverse} />
                )}
                <Text
                  style={{
                    ...typography.preset.small,
                    color: active ? colors.text.inverse : colors.text.primary,
                  }}
                >
                  {t(`carte.filters.${value}`)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
  const inventoryStatus =
    failed || noResults || noMappedPlaces ? (
      <View
        style={{
          marginHorizontal: spacing.base,
          marginVertical: spacing.sm,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.surface.subtle,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        <Text
          accessibilityLiveRegion="polite"
          style={{
            ...typography.preset.small,
            flex: 1,
            paddingVertical: spacing.md,
            color: colors.text.secondary,
          }}
        >
          {t(
            failed
              ? "carte.inventory_failed"
              : noMappedPlaces
                ? "carte.unmapped_selection"
                : filter === "all"
                  ? "carte.empty"
                  : "carte.empty_filter",
          )}
        </Text>
        {(failed || filter !== "all" || noMappedPlaces) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              failed
                ? "common.retry"
                : noMappedPlaces
                  ? "carte.show_list"
                  : "carte.filters.all",
            )}
            onPress={
              failed
                ? () => void reload()
                : noMappedPlaces
                  ? toggleView
                  : () => setFilter("all")
            }
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{ ...typography.preset.small, color: colors.brand.accent }}
            >
              {t(
                failed
                  ? "common.retry"
                  : noMappedPlaces
                    ? "carte.show_list"
                    : "carte.filters.all",
              )}
            </Text>
          </Pressable>
        )}
      </View>
    ) : null;

  const listStyle = {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  };
  const row = (place: PlaceWithAdn) => (
    <PlaceLink
      key={place.id}
      place={place}
      explored={explored.has(place.id)}
      onPress={() => openPlace(place.id)}
    />
  );
  const listHint = moduleFailed
    ? "carte.module_unavailable"
    : styleFailed
      ? "carte.style_unavailable"
      : visiblePlaces.length > locatedPlaces.length
        ? "carte.location_pending_hint"
        : null;
  const listHeader = listHint ? (
    <Text
      accessibilityLiveRegion="polite"
      style={{
        ...typography.preset.small,
        paddingVertical: spacing.md,
        color: colors.text.secondary,
      }}
    >
      {t(listHint)}
    </Text>
  ) : null;
  return (
    <Container
      edges={["top"]}
      style={{
        flex: 1,
        minHeight: embedded ? 420 : undefined,
        backgroundColor: colors.surface.base,
      }}
    >
      {!embedded && <DataSourceBanner />}
      {controls}
      {inventoryStatus}
      {showList ? (
        embedded ? (
          <View style={listStyle}>
            {listHeader}
            {visiblePlaces.map(row)}
          </View>
        ) : (
          <FlatList
            data={visiblePlaces}
            keyExtractor={(place) => place.id}
            renderItem={({ item }) => row(item)}
            extraData={explored}
            ListHeaderComponent={listHeader}
            contentContainerStyle={listStyle}
          />
        )
      ) : (
        <View
          style={{
            flex: 1,
            minHeight: embedded ? 320 : undefined,
            backgroundColor: colors.surface.subtle,
          }}
        >
          {maplibre && visible ? (
            <PlaceMapSurface
              library={maplibre}
              center={center}
              points={points}
              selectedId={selected?.id}
              onSelect={setSelectedId}
              onStyleFailure={reportStyleFailure}
            />
          ) : visible ? (
            <View style={styles.mapLoading}>
              <ActivityIndicator
                accessibilityLabel={t("carte.loading")}
                color={colors.brand.accent}
              />
            </View>
          ) : null}
          {selected && visible && (
            <View
              testID="carte-selected-place"
              style={{
                position: "absolute",
                bottom: spacing.xl,
                left: spacing.base,
                right: spacing.base,
                maxWidth: 460,
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: spacing.base,
                paddingRight: spacing.xs,
                borderWidth: 1,
                borderColor: colors.border.strong,
                borderRadius: radius.card,
                backgroundColor: colors.surface.base,
                elevation: 3,
              }}
            >
              <Pressable
                testID="carte-open-selected"
                accessibilityRole="button"
                accessibilityLabel={t("rapide.card_open_aria", {
                  name: selected.name,
                })}
                onPress={() => openPlace(selected.id)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  minHeight: 60,
                }}
              >
                <Ico name="pin" filled color={colors.brand.primary} size={24} />
                <View style={{ flex: 1, paddingVertical: spacing.sm }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      ...typography.preset.h3,
                      color: colors.text.primary,
                    }}
                  >
                    {selected.name}
                  </Text>
                  {selected.location?.neighborhood && (
                    <Text
                      numberOfLines={1}
                      style={{
                        ...typography.preset.small,
                        color: colors.text.secondary,
                      }}
                    >
                      {selected.location.neighborhood}
                    </Text>
                  )}
                </View>
                <Ico
                  name="chevron-right"
                  color={colors.brand.accent}
                  size={17}
                />
              </Pressable>
              <Pressable
                testID="carte-close-selected"
                accessibilityRole="button"
                accessibilityLabel={t("carte.dismiss_preview")}
                onPress={() => setSelectedId(null)}
                style={{
                  width: 44,
                  height: 44,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ico name="close" color={colors.text.secondary} size={18} />
              </Pressable>
            </View>
          )}
        </View>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  mapLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
});

function PlaceMapSurface({
  library,
  center,
  points,
  selectedId,
  onSelect,
  onStyleFailure,
}: {
  library: MapLibreModule;
  center: [number, number];
  points: PlacePoints;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onStyleFailure: () => void;
}) {
  const { Map: NativeMap, Camera, GeoJSONSource, Layer } = library;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [styleReady, setStyleReady] = useState(false);
  useEffect(() => {
    if (styleReady) return;
    const timer = setTimeout(onStyleFailure, 18000);
    return () => clearTimeout(timer);
  }, [styleReady, onStyleFailure]);
  return (
    <>
      <NativeMap
        style={StyleSheet.absoluteFill}
        androidView="texture"
        mapStyle={MAP_STYLE_URL}
        tintColor={colors.brand.accent}
        testID="carte-mapview"
        onDidFinishLoadingStyle={() => setStyleReady(true)}
        onDidFailLoadingMap={onStyleFailure}
      >
        <Camera initialViewState={{ center, zoom: DEFAULT_ZOOM }} />
        {styleReady && (
          <GeoJSONSource
            id="spawt-places"
            data={points}
            onPress={(event) => {
              const id = event.nativeEvent.features[0]?.properties?.placeId;
              if (
                typeof id === "string" &&
                points.features.some((point) => point.properties.placeId === id)
              )
                onSelect(id);
            }}
          >
            <Layer
              id="spawt-pins"
              type="circle"
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  10,
                  3,
                  13,
                  6.5,
                  16,
                  10,
                ],
                "circle-stroke-width": [
                  "case",
                  ["==", ["get", "placeId"], selectedId ?? ""],
                  4,
                  1.5,
                ],
                "circle-stroke-color": colors.surface.inverse,
                "circle-color": [
                  "case",
                  ["get", "explored"],
                  colors.brand.accent,
                  colors.brand.primary,
                ],
              }}
            />
            <Layer
              id="spawt-names"
              type="symbol"
              minzoom={13}
              layout={{
                "text-field": ["get", "name"],
                "text-size": 12,
                "text-anchor": "top",
                "text-offset": [0, 0.9],
              }}
              paint={{
                "text-color": colors.text.primary,
                "text-halo-color": colors.surface.base,
                "text-halo-width": 1.4,
              }}
            />
          </GeoJSONSource>
        )}
      </NativeMap>
      {!styleReady && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.mapLoading]}
        >
          <ActivityIndicator
            accessibilityLabel={t("carte.loading")}
            color={colors.brand.accent}
          />
        </View>
      )}
    </>
  );
}

/** Actual inventory only; unavailable photos use an icon, never an unrelated image. */
function PlaceLink({
  place,
  onPress,
  explored = false,
}: {
  place: PlaceWithAdn;
  onPress: () => void;
  explored?: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("rapide.card_open_aria", { name: place.name })}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 12,
        minHeight: 92,
        borderRadius: theme.radius.card,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: theme.colors.surface.base,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {place.cover_photo_url && !photoFailed ? (
        <Image
          source={{ uri: place.cover_photo_url }}
          onError={() => setPhotoFailed(true)}
          style={{ width: 72, height: 72, borderRadius: theme.radius.lg }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 72,
            height: 72,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surface.subtle,
          }}
        >
          <Ico name="pin" size={32} color={theme.colors.brand.primary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            ...theme.typography.preset.h3,
            color: theme.colors.text.primary,
          }}
        >
          {place.name}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
          }}
        >
          {t(explored ? "carte.explored" : "carte.to_explore")}
          {!hasPlaceCoordinates(place)
            ? ` · ${t("place.location_pending")}`
            : ""}
        </Text>
        {place.location?.neighborhood ? (
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.text.secondary,
            }}
          >
            {place.location.neighborhood}
          </Text>
        ) : null}
        <Text
          style={{
            ...theme.typography.preset.caption,
            color: theme.colors.text.primary,
          }}
        >
          {t("carte.open_place")}
        </Text>
      </View>
      <Ico name="chevron-right" size={20} color={theme.colors.brand.primary} />
    </Pressable>
  );
}
