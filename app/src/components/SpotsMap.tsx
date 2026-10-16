import { Platform } from "react-native";
import { PanelNotice } from "./ExploreCollections";
import { useNavigationAction } from "../lib/use-navigation-action";
// Phase 2 — Onglet Carte : carte interactive MapLibre (PRD Feature 11).
// Remplace le stub Story 3.1. Choix MapLibre (vs Mapbox/Google) : open-source,
// zéro clé API (tuiles OpenFreeMap), cohérent avec le prototype web (maplibre-gl).
//
// Le module natif est chargé DYNAMIQUEMENT : absent en Expo Go / web / jest →
// fallback EmptyState propre, jamais de crash. Rendu réel à valider en build
// EAS (New Architecture RN 0.83 — cf. skill spawt-release).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
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

// Style sombre sans clé API — OpenFreeMap (tuiles OSM, usage libre).
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const DEFAULT_ZOOM = 12;

type MapLibreModule = typeof import("@maplibre/maplibre-react-native");

export function SpotsMap({ embedded = false }: { embedded?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const navigate = useNavigationAction();
  const Container = embedded ? View : SafeAreaView;
  const { t } = useTranslation();
  const position = useSpawterPosition();

  const [maplibre, setMaplibre] = useState<MapLibreModule | null>(null);
  const [moduleFailed, setModuleFailed] = useState(false);
  const { places, loading, failed, reload } = usePlaces();
  const trackedOpen = useRef(false);

  // Chargement dynamique du module natif — fallback si absent (Expo Go / web).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (Platform.OS === "web") throw new Error("Native map unavailable");
        const mod = await import("@maplibre/maplibre-react-native");
        if (!cancelled) setMaplibre(mod);
      } catch {
        if (!cancelled) setModuleFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const center = useMemo<[number, number]>(
    () => [position.lng, position.lat],
    [position.lat, position.lng],
  );

  if (moduleFailed) {
    const Content = embedded ? View : ScrollView;
    return (
      <Container
        edges={["top"]}
        style={{ flex: 1, backgroundColor: theme.colors.surface.subtle }}
      >
        {!embedded ? <DataSourceBanner /> : null}
        <Content>
          <PanelNotice
            title={t("carte.unavailable_title")}
            message={t("carte.module_unavailable")}
          />
          <DataLoadNotice
            loading={loading}
            failed={failed}
            onRetry={() => void reload()}
          />
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.lg,
              gap: 12,
            }}
          >
            {places.some((place) => place.is_published) ? (
              <Text
                style={{
                  ...theme.typography.preset.h2,
                  color: theme.colors.text.primary,
                }}
              >
                {t("carte.available_places")}
              </Text>
            ) : null}
            {places
              .filter((place) => place.is_published)
              .map((place) => (
                <PlaceLink
                  key={place.id}
                  place={place}
                  onPress={() => openPlace(place.id)}
                />
              ))}
            {!loading && !failed && places.length === 0 ? (
              <PanelNotice message={t("carte.empty")} />
            ) : null}
          </View>
        </Content>
      </Container>
    );
  }

  if (!maplibre) {
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
        <PanelNotice message={t("carte.loading")} />
      </Container>
    );
  }

  const { Map: MapLibreMap, Camera, Marker } = maplibre;

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
      <DataLoadNotice
        loading={loading}
        failed={failed}
        onRetry={() => void reload()}
      />
      {position.source === "fallback" ? (
        <PanelNotice message={t("carte.city_fallback")} />
      ) : null}
      {!loading && !failed && places.length === 0 ? (
        <PanelNotice message={t("carte.empty")} />
      ) : null}
      <MapLibreMap
        style={{ flex: 1, minHeight: 340 }}
        mapStyle={DARK_STYLE_URL}
        testID="carte-mapview"
      >
        <Camera initialViewState={{ center, zoom: DEFAULT_ZOOM }} />
        {places.map((p) => (
          <Marker
            key={p.id}
            lngLat={[p.location.lng, p.location.lat]}
            onPress={() => openPlace(p.id)}
          >
            <Pressable
              onPress={() => openPlace(p.id)}
              accessibilityRole="button"
              accessibilityLabel={p.name}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View style={{ alignItems: "center", maxWidth: 120 }}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: theme.colors.brand.primary,
                    borderWidth: 2,
                    borderColor: theme.colors.surface.base,
                  }}
                />
                <Text
                  style={{
                    ...theme.typography.preset.caption,
                    color: theme.colors.text.inverse,
                    backgroundColor: theme.colors.overlay.scrim,
                    paddingHorizontal: 4,
                    borderRadius: theme.radius.sm,
                    marginTop: 2,
                    overflow: "hidden",
                  }}
                >
                  {p.name}
                </Text>
              </View>
            </Pressable>
          </Marker>
        ))}
      </MapLibreMap>
    </Container>
  );
}

/** Actual inventory only; unavailable photos use an icon, never an unrelated image. */
function PlaceLink({
  place,
  onPress,
}: {
  place: PlaceWithAdn;
  onPress: () => void;
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
        {place.location.neighborhood ? (
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
