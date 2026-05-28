// Story 4.10 — Onglet Spawter géolocalisé.
//
// Écran accessible UNIQUEMENT via tap sur le FAB central de la TabBar
// (route masquée du TabBar via `href: null` dans _layout.tsx). Remplace
// le stub Alert du FAB livré en Story 3.1.
//
// Flux :
//   1. Mount → check perm foreground via expo-location (no pré-fetch boot).
//   2. Si granted → getCurrentPositionAsync → listNearbyPlaces(2km, top 5).
//   3. Tap "Spawter ici" → buildManualSpawt → registerSpawt → upsertSpawt
//      (fire-and-forget) → router.push("/review/[spawt_id]") modal.
//
// `is_verified` du spawt produit = `is_within_spawt_range` (distance < 100m).
// Sinon spawt passif (poids 0.5x — PRD §7.2 PASSIVE_CHECKIN_WEIGHT).
//
// Pas de carte interactive en V1 (déféré Sprint 2). Liste textuelle suffit.
// Pas de hiérarchie « le plus proche est mieux » — tri pur par distance,
// sans podium ni mise en avant compétitive (anti-pattern PRD §20.1).

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";

import { useTheme } from "../../src/theme/ThemeProvider";
import { Chip } from "../../src/components/primitives/Chip";
import { Ico } from "../../src/components/primitives/Ico";
import {
  formatDistance,
  listNearbyPlaces,
  type NearbyPlace,
} from "../../src/lib/nearby-places";
import { listPlaces } from "../../src/lib/data-source";
import { buildManualSpawt } from "../../src/lib/guet/guet-spawt-actions";
import { upsertSpawt } from "../../src/lib/data-source";
import { useSpawterStore } from "../../src/store/spawter-store";
import { track } from "../../src/lib/analytics";

type ScreenState =
  | { kind: "loading_perm" }
  | { kind: "perm_denied" }
  | { kind: "loading_position" }
  | { kind: "empty" }
  | { kind: "loaded"; items: NearbyPlace[]; userLat: number; userLng: number };

const PRICE_LABELS: Record<1 | 2 | 3, string> = {
  1: "₣",
  2: "₣₣",
  3: "₣₣₣",
};

export default function SpawterTabScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const spawter = useSpawterStore((s) => s.spawter);
  const registerSpawt = useSpawterStore((s) => s.registerSpawt);

  const [state, setState] = useState<ScreenState>({ kind: "loading_perm" });

  const loadNearby = useCallback(async () => {
    setState({ kind: "loading_perm" });

    // 1. Permission foreground.
    let permGranted = false;
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === "granted") {
        permGranted = true;
      } else if (current.status === "undetermined" || current.canAskAgain) {
        const req = await Location.requestForegroundPermissionsAsync();
        permGranted = req.status === "granted";
      }
    } catch (err) {
      if (__DEV__) {
        console.warn("[spawter-tab] expo-location permission threw", err);
      }
      // Native module manquant (web / Expo Go bare) → on retombe sur perm_denied
      // plutôt que crasher.
    }

    if (!permGranted) {
      setState({ kind: "perm_denied" });
      track({
        name: "nearby_screen_opened",
        properties: { count_in_radius: 0, has_geoloc_perm: false },
      });
      return;
    }

    // 2. Position.
    setState({ kind: "loading_position" });
    let userLat: number;
    let userLng: number;
    try {
      const pos = await Location.getCurrentPositionAsync({});
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
    } catch (err) {
      if (__DEV__) console.warn("[spawter-tab] getCurrentPositionAsync failed", err);
      setState({ kind: "perm_denied" });
      track({
        name: "nearby_screen_opened",
        properties: { count_in_radius: 0, has_geoloc_perm: false },
      });
      return;
    }

    // 3. Listing.
    try {
      const places = await listPlaces();
      const items = listNearbyPlaces(places, userLat, userLng);
      track({
        name: "nearby_screen_opened",
        properties: { count_in_radius: items.length, has_geoloc_perm: true },
      });
      if (items.length === 0) {
        setState({ kind: "empty" });
        return;
      }
      setState({ kind: "loaded", items, userLat, userLng });
    } catch (err) {
      if (__DEV__) console.warn("[spawter-tab] listPlaces failed", err);
      setState({ kind: "empty" });
    }
  }, []);

  useEffect(() => {
    void loadNearby();
  }, [loadNearby]);

  const handleSpawt = useCallback(
    async (item: NearbyPlace, userLat: number, userLng: number) => {
      if (!spawter) {
        if (__DEV__) console.warn("[spawter-tab] handleSpawt called without spawter");
        return;
      }

      // 1. Build row manuel — buildManualSpawt attend les coords spawter
      //    (PRD §7.2 anti-fraude trigger `frequence_meme_lieu` compare
      //    distance spawter↔lieu, donc on lui passe les coords USER).
      const row = buildManualSpawt(
        spawter.id,
        item.place.id,
        userLat,
        userLng,
      );
      // 2. Override `is_verified` selon la distance réelle spawter → lieu
      //    (buildManualSpawt par défaut force false — Story 4.10 décide
      //    is_verified=true uniquement si dans la zone de 100m). Le
      //    `geolocation_source` doit suivre la sémantique :
      //    - dans la zone → "gps" (la position user est exploitable)
      //    - hors zone → "manual" (passive_checkin, distance approximative)
      const verifiedRow = {
        ...row,
        is_verified: item.is_within_spawt_range,
        geolocation_source: item.is_within_spawt_range
          ? ("gps" as const)
          : ("manual" as const),
        geolocation_lat: userLat,
        geolocation_lng: userLng,
      };

      // 3. Analytics avant navigation.
      track({
        name: "nearby_spawt_tapped",
        properties: {
          place_id: item.place.id,
          distance_m: Math.round(item.distance_km * 1000),
          is_within_range: item.is_within_spawt_range,
        },
      });

      // 4. Persist local + fire-and-forget Supabase.
      await registerSpawt(verifiedRow);
      void upsertSpawt(verifiedRow).catch((err) => {
        if (__DEV__) console.warn("[spawter-tab] upsertSpawt failed", err);
      });

      // 5. Navigate vers le modal review (Story 4.5).
      router.push(`/review/${verifiedRow.id}`);
    },
    [spawter, registerSpawt, router],
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      edges={["top", "bottom"]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.subtle,
        }}
      >
        <Text
          style={{
            ...theme.typography.preset.h3,
            color: theme.colors.text.primary,
          }}
          accessibilityRole="header"
        >
          {t("fab.nearby_title")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("fab.nearby_close_label")}
          onPress={() => router.back()}
          hitSlop={12}
          testID="spawter-tab-close"
        >
          <Ico name="close" size={24} color={theme.colors.text.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        {state.kind === "loading_perm" || state.kind === "loading_position" ? (
          <View
            style={{ alignItems: "center", paddingVertical: theme.spacing.xl }}
            testID="spawter-tab-loading"
          >
            <ActivityIndicator size="large" color={theme.colors.brand.primary} />
            <Text
              style={{
                marginTop: theme.spacing.md,
                ...theme.typography.preset.body,
                color: theme.colors.text.secondary,
              }}
            >
              {t("fab.nearby_loading")}
            </Text>
          </View>
        ) : null}

        {state.kind === "perm_denied" ? (
          <View
            style={{ alignItems: "center", paddingVertical: theme.spacing.xl }}
            testID="spawter-tab-perm-required"
          >
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.primary,
                textAlign: "center",
                marginBottom: theme.spacing.lg,
              }}
            >
              {t("fab.nearby_perm_required")}
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="spawter-tab-open-settings"
              onPress={() => {
                void Linking.openSettings();
              }}
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                backgroundColor: theme.colors.brand.primary,
                borderRadius: theme.radius.md,
              }}
            >
              <Text
                style={{
                  ...theme.typography.preset.body,
                  fontFamily: theme.typography.family.body,
                  fontWeight: theme.typography.weight.bold,
                  color: theme.colors.text.onBrand,
                }}
              >
                {t("fab.nearby_perm_open_settings")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {state.kind === "empty" ? (
          <View
            style={{ alignItems: "center", paddingVertical: theme.spacing.xl }}
            testID="spawter-tab-empty"
          >
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.primary,
                textAlign: "center",
              }}
            >
              {t("fab.nearby_empty")}
            </Text>
          </View>
        ) : null}

        {state.kind === "loaded"
          ? state.items.map((item) => {
              // Capture les coords USER du state.loaded — pas du lieu —
              // pour préserver l'invariant anti-fraude (distance réelle
              // spawter↔lieu). item.distance_km a été calculé au mount,
              // staleness ≤30s typique acceptée V1.
              const userLat = state.userLat;
              const userLng = state.userLng;
              return (
                <NearbyCard
                  key={item.place.id}
                  item={item}
                  onSpawt={() => void handleSpawt(item, userLat, userLng)}
                />
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

interface NearbyCardProps {
  item: NearbyPlace;
  onSpawt: () => void;
}

function NearbyCard({ item, onSpawt }: NearbyCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { place } = item;
  const firstCuisine = place.cuisine[0] ?? null;
  const cuisineLabel = firstCuisine
    ? t(`cuisine.${firstCuisine}`, { defaultValue: firstCuisine })
    : null;
  const priceLabel = PRICE_LABELS[place.price.tier];

  return (
    <View
      testID={`spawter-tab-card-${place.id}`}
      style={{
        flexDirection: "row",
        backgroundColor: theme.colors.surface.raised,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        gap: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      {place.cover_photo_url ? (
        <Image
          source={{ uri: place.cover_photo_url }}
          style={{
            width: 50,
            height: 50,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.surface.subtle,
          }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.surface.subtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ico name="pin" size={24} color={theme.colors.text.tertiary} />
        </View>
      )}

      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text
          style={{
            ...theme.typography.preset.h3,
            color: theme.colors.text.primary,
          }}
          numberOfLines={1}
        >
          {place.name}
        </Text>

        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
          }}
          testID={`spawter-tab-distance-${place.id}`}
        >
          {formatDistance(item.distance_km)}
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.spacing.xs,
            marginTop: theme.spacing.xs,
          }}
        >
          {cuisineLabel ? (
            <Chip label={cuisineLabel} variant="outline" />
          ) : null}
          <Chip label={priceLabel} variant="outline" />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("fab.nearby_cta_spawt")}
          testID={`spawter-tab-cta-${place.id}`}
          onPress={onSpawt}
          style={{
            marginTop: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.brand.accent,
            borderRadius: theme.radius.sm,
            alignSelf: "flex-start",
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.body,
              fontFamily: theme.typography.family.body,
              fontWeight: theme.typography.weight.bold,
              color: theme.colors.text.inverse,
            }}
          >
            {t("fab.nearby_cta_spawt")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
