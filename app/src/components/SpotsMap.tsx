import { requireOptionalNativeModule } from "expo";
import { PanelNotice } from "./ExploreCollections";
import { useNavigationAction } from "../lib/use-navigation-action";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { FeatureCollection, Point } from "geojson";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlaces } from "../lib/use-places";
import { DataLoadNotice } from "./DataLoadNotice";
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
import { useSpawterStore } from "../store/spawter-store";

// Style sombre sans clé API — OpenFreeMap (tuiles OSM, usage libre).
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const DEFAULT_ZOOM = 12;

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

  const hasPosition = isMapCoordinate(position.lat, position.lng);
  const center = useMemo<[number, number]>(() => {
    if (hasPosition) return [position.lng, position.lat];
    const city = getActiveCity();
    if (isMapCoordinate(city.default_lat, city.default_lng))
      return [city.default_lng, city.default_lat];
    return [ABIDJAN_FALLBACK.default_lng, ABIDJAN_FALLBACK.default_lat];
  }, [hasPosition, position.lat, position.lng]);
  const reportStyleFailure = useCallback(() => setStyleFailed(true), []);
  function toggleView() {
    if (styleFailed) {
      setStyleFailed(false);
      setListMode(false);
    } else setListMode((value) => !value);
  }

  const controls = (
    <View style={{ padding: theme.spacing.base, gap: theme.spacing.sm }}>
      <View
        accessibilityRole="radiogroup"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.spacing.base,
        }}
      >
        {(["all", "unexplored", "mine"] as const).map((value) => (
          <Pressable
            key={value}
            testID={`carte-filter-${value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: filter === value }}
            onPress={() => setFilter(value)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                ...theme.typography.preset.small,
                fontFamily:
                  filter === value
                    ? theme.typography.preset.overline.fontFamily
                    : theme.typography.family.body,
                color: theme.colors.text.primary,
              }}
            >
              {t(`carte.filters.${value}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text
        testID="carte-inventory-count"
        style={{
          ...theme.typography.preset.small,
          color: theme.colors.text.secondary,
        }}
      >
        {t("carte.inventory_count", {
          total: visiblePlaces.length,
          mapped: locatedPlaces.length,
        })}
      </Text>
      {visiblePlaces.length > locatedPlaces.length ? (
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
          }}
        >
          {t("carte.location_pending_hint")}
        </Text>
      ) : null}
      {!moduleFailed ? (
        <Pressable
          testID="carte-view-toggle"
          accessibilityRole="button"
          onPress={toggleView}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.brand.accent,
            }}
          >
            {t(listMode || styleFailed ? "carte.show_map" : "carte.show_list")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (moduleFailed || listMode || styleFailed) {
    const header = (
      <>
        {moduleFailed || styleFailed ? (
          <PanelNotice
            title={t("carte.unavailable_title")}
            message={t(
              styleFailed
                ? "carte.style_unavailable"
                : "carte.module_unavailable",
            )}
          />
        ) : null}
        <DataLoadNotice
          loading={loading}
          failed={failed}
          onRetry={() => void reload()}
        />
        {visiblePlaces.length ? (
          <Text
            style={{
              ...theme.typography.preset.h2,
              color: theme.colors.text.primary,
            }}
          >
            {t("carte.available_places")}
          </Text>
        ) : null}
        {!loading && !failed && visiblePlaces.length === 0 ? (
          <PanelNotice message={t("carte.empty")} />
        ) : null}
      </>
    );
    const listStyle = {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      gap: 12,
    };
    const row = (place: PlaceWithAdn) => (
      <PlaceLink
        key={place.id}
        place={place}
        explored={explored.has(place.id)}
        onPress={() => openPlace(place.id)}
      />
    );
    return (
      <Container
        edges={["top"]}
        style={{ flex: 1, backgroundColor: theme.colors.surface.subtle }}
      >
        {!embedded ? <DataSourceBanner /> : null}
        {controls}
        {embedded ? (
          <View style={listStyle}>
            {header}
            {visiblePlaces.map(row)}
          </View>
        ) : (
          <FlatList
            data={visiblePlaces}
            keyExtractor={(place) => place.id}
            renderItem={({ item }) => row(item)}
            extraData={explored}
            ListHeaderComponent={header}
            contentContainerStyle={listStyle}
          />
        )}
      </Container>
    );
  }

  if (!maplibre || !visible) {
    // Native module loading is announced independently from inventory loading.
    return (
      <Container
        edges={["top"]}
        style={{
          flex: 1,
          minHeight: embedded ? 420 : undefined,
          backgroundColor: theme.colors.surface.base,
        }}
      >
        {!embedded ? <DataSourceBanner /> : null}
        {controls}
        <PanelNotice message={t("carte.loading")} />
      </Container>
    );
  }

  return (
    <Container
      edges={["top"]}
      style={{
        flex: 1,
        minHeight: embedded ? 420 : undefined,
        backgroundColor: theme.colors.surface.base,
      }}
    >
      {!embedded ? <DataSourceBanner /> : null}
      {controls}
      <DataLoadNotice
        loading={loading}
        failed={failed}
        onRetry={() => void reload()}
      />
      {position.source === "fallback" || !hasPosition ? (
        <PanelNotice message={t("carte.city_fallback")} />
      ) : null}
      {!loading && !failed && places.length === 0 ? (
        <PanelNotice message={t("carte.empty")} />
      ) : null}
      <PlaceMapSurface
        library={maplibre}
        center={center}
        points={points}
        onOpen={openPlace}
        onStyleFailure={reportStyleFailure}
      />
    </Container>
  );
}

function PlaceMapSurface({
  library,
  center,
  points,
  onOpen,
  onStyleFailure,
}: {
  library: MapLibreModule;
  center: [number, number];
  points: PlacePoints;
  onOpen: (id: string) => void;
  onStyleFailure: () => void;
}) {
  const { Map: NativeMap, Camera, GeoJSONSource, Layer } = library;
  const { colors } = useTheme();
  const [styleReady, setStyleReady] = useState(false);
  useEffect(() => {
    if (styleReady) return;
    const timer = setTimeout(onStyleFailure, 18000);
    return () => clearTimeout(timer);
  }, [styleReady, onStyleFailure]);
  return (
    <NativeMap
      style={{ flex: 1, minHeight: 340 }}
      androidView="texture"
      mapStyle={DARK_STYLE_URL}
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
              onOpen(id);
          }}
        >
          <Layer
            id="spawt-pins"
            type="circle"
            paint={{
              "circle-radius": 8,
              "circle-stroke-width": 2,
              "circle-stroke-color": colors.surface.base,
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
              "text-color": colors.text.inverse,
              "text-halo-color": colors.surface.inverse,
              "text-halo-width": 1.4,
            }}
          />
        </GeoJSONSource>
      )}
    </NativeMap>
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
