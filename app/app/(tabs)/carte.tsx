// Phase 2 — Onglet Carte : carte interactive MapLibre (PRD Feature 11).
// Remplace le stub Story 3.1. Choix MapLibre (vs Mapbox/Google) : open-source,
// zéro clé API (tuiles OpenFreeMap), cohérent avec le prototype web (maplibre-gl).
//
// Le module natif est chargé DYNAMIQUEMENT : absent en Expo Go / web / jest →
// fallback EmptyState propre, jamais de crash. Rendu réel à valider en build
// EAS (New Architecture RN 0.83 — cf. skill spawt-release).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../src/theme/ThemeProvider";
import { DataSourceBanner } from "../../src/components/DataSourceBanner";
import { EmptyState } from "../../src/components/EmptyState";
import { listPlaces, type PlaceWithAdn } from "../../src/lib/data-source";
import { useSpawterPosition } from "../../src/lib/use-spawter-position";
import { track } from "../../src/lib/analytics";

// Style sombre sans clé API — OpenFreeMap (tuiles OSM, usage libre).
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const DEFAULT_ZOOM = 12;

type MapLibreModule = typeof import("@maplibre/maplibre-react-native");

export default function CarteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const position = useSpawterPosition();

  const [maplibre, setMaplibre] = useState<MapLibreModule | null>(null);
  const [moduleFailed, setModuleFailed] = useState(false);
  const [places, setPlaces] = useState<PlaceWithAdn[]>([]);
  const trackedOpen = useRef(false);

  // Chargement dynamique du module natif — fallback si absent (Expo Go / web).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
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
    let cancelled = false;
    void (async () => {
      try {
        const all = await listPlaces();
        if (!cancelled) setPlaces(all.filter((p) => p.location?.lat != null));
      } catch {
        // Réseau KO — carte vide, le bandeau data-source informe déjà.
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
      track({
        name: "feed_card_clicked",
        properties: { place_id, surface: "carte" },
      });
      router.push(`/place/${place_id}`);
    },
    [router],
  );

  const center = useMemo<[number, number]>(
    () => [position.lng, position.lat],
    [position.lat, position.lng],
  );

  if (moduleFailed) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      >
        <DataSourceBanner />
        <EmptyState
          icon="map"
          title={t("empty_state.map_title")}
          body={t("carte.module_unavailable")}
        />
      </SafeAreaView>
    );
  }

  if (!maplibre) {
    // Module en cours de chargement — écran neutre bref.
    return (
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      >
        <DataSourceBanner />
      </SafeAreaView>
    );
  }

  const { Map: MapLibreMap, Camera, Marker } = maplibre;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <DataSourceBanner />
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={DARK_STYLE_URL}
        testID="carte-mapview"
      >
        <Camera
          initialViewState={{ center, zoom: DEFAULT_ZOOM }}
        />
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
                  numberOfLines={1}
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
    </SafeAreaView>
  );
}
