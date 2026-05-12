// Feed personnalisé — PRD §3.1 Feature 3
// Mode démo : utilise SEED_PLACES + position fixe Cocody Riviera.
// Les scores sont calculés avec computeRawScore (PRD §8.1).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Text, View, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../src/theme/ThemeProvider";
import { ChatBubble } from "../../src/components/ChatBubble";
import { PlaceCard } from "../../src/components/PlaceCard";
import { DataSourceBanner } from "../../src/components/DataSourceBanner";
import { listPlaces, type PlaceWithAdn } from "../../src/lib/data-source";
import { computeRawScore, displayedScore } from "../../src/lib/matching";
import { useSpawterStore } from "../../src/store/spawter-store";
import { EMPTY_PALAIS } from "../../src/data/seed/sample-spawter";

// Position de référence en mode démo — Cocody Riviera
const DEMO_LAT = 5.358;
const DEMO_LNG = -3.97;

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const palais = useSpawterStore((s) => s.palais ?? EMPTY_PALAIS);
  const spawter = useSpawterStore((s) => s.spawter);
  const spawts = useSpawterStore((s) => s.spawts);

  const [places, setPlaces] = useState<PlaceWithAdn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const visited = useMemo(
    () => new Set(spawts.filter((s) => s.is_verified).map((s) => s.place_id)),
    [spawts],
  );

  const fetchPlaces = async () => {
    const data = await listPlaces();
    setPlaces(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void fetchPlaces();
  }, []);

  const ranked = useMemo(() => {
    const now = new Date();
    return places
      .map((p) => {
        const score = computeRawScore(
          {
            spawter_palais: palais,
            spawter_lat: DEMO_LAT,
            spawter_lng: DEMO_LNG,
            visited_place_ids: visited,
            now,
          },
          {
            place: p,
            adn: p.adn,
            last_spawt_at: null,
          },
        );
        const distanceKm = haversine(
          DEMO_LAT,
          DEMO_LNG,
          p.location.lat,
          p.location.lng,
        );
        return { place: p, score: displayedScore(score), distanceKm };
      })
      .sort((a, b) => b.score - a.score);
  }, [places, palais, visited]);

  const stade = spawter?.stade ?? "touriste";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <DataSourceBanner />
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          data={ranked}
          keyExtractor={(item) => item.place.id}
          contentContainerStyle={{ padding: theme.spacing.base, paddingBottom: theme.spacing["2xl"] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void fetchPlaces();
              }}
              tintColor={theme.colors.brand.primary}
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: theme.spacing.lg }}>
              <Text
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.size["2xl"],
                  fontWeight: theme.typography.weight.bold,
                  marginBottom: theme.spacing.sm,
                }}
              >
                Salut {spawter?.display_name ?? "Touriste"}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.size.sm,
                  marginBottom: theme.spacing.base,
                }}
              >
                {spawts.length === 0
                  ? "Aucun spawt encore. Choisis un lieu et lance-toi."
                  : `${spawts.length} spawt${spawts.length > 1 ? "s" : ""} · ${spawter?.unique_spots ?? 0} spot${(spawter?.unique_spots ?? 0) > 1 ? "s" : ""} unique${(spawter?.unique_spots ?? 0) > 1 ? "s" : ""}`}
              </Text>
              <ChatBubble
                stade={stade}
                moment={spawts.length === 0 ? "first_spawt_invite" : "welcome_back"}
              />
            </View>
          }
          renderItem={({ item }) => (
            <PlaceCard
              place={item.place}
              matchScore={item.score}
              distanceKm={item.distanceKm}
              onPress={() => router.push(`/place/${item.place.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
