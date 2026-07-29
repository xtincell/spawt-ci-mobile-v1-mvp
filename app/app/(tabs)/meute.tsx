// Phase 2 — Onglet Meute : fil d'activité communautaire (remplace le stub 3.1).
// Sources publiques (RLS) : avis publiés + Coups de Cœur du mois. Lecture
// seule V1 — la communauté se regarde vivre avant d'interagir. Mode démo :
// EmptyState (pas d'activité communautaire sans backend).
//
// Mode Crew (post-MVP #2) : bloc « Ton Crew » EN PLUS du fil, derrière le
// flag `mode-crew` — flag off → l'onglet est strictement inchangé
// (non-régression testée dans meute-crew-flag.test.tsx).

import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../src/theme/ThemeProvider";
import { DataSourceBanner } from "../../src/components/DataSourceBanner";
import { EmptyState } from "../../src/components/EmptyState";
import { Stars } from "../../src/components/primitives/Stars";
import { CrewBlock } from "../../src/components/crew/CrewBlock";
import {
  listMeuteActivity,
  isSupabaseConfigured,
  type MeuteActivityItem,
} from "../../src/lib/data-source";
import { track } from "../../src/lib/analytics";
import { useFlag } from "../../src/store/feature-flags";

export default function MeuteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const crewEnabled = useFlag("mode-crew");

  const [items, setItems] = useState<MeuteActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const activity = await listMeuteActivity(30);
      setItems(activity);
    } catch {
      // Réseau KO — on garde la liste précédente.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    track({ name: "feed_viewed", properties: { surface: "meute" } });
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const empty = !loading && items.length === 0;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <DataSourceBanner />
      {crewEnabled ? <CrewBlock /> : null}
      {empty || !isSupabaseConfigured ? (
        <EmptyState
          icon="compass"
          title={t("empty_state.meute_title")}
          body={t("meute.empty_body")}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ padding: theme.spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <Text
              style={{
                ...theme.typography.preset.h1,
                color: theme.colors.text.primary,
                marginBottom: theme.spacing.base,
              }}
            >
              {t("meute.title")}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/place/${item.place_id}`)}
              style={({ pressed }) => ({
                flexDirection: "row",
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.base,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.subtle,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor:
                    item.kind === "coup"
                      ? theme.colors.brand.primary
                      : theme.colors.brand.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 14 }}>
                  {item.kind === "coup" ? "❤️" : "⭐"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.primary,
                  }}
                >
                  {item.kind === "coup"
                    ? t("meute.item_coup", {
                        spawter: item.spawter_display_name,
                        place: item.place_name,
                      })
                    : t("meute.item_review", {
                        spawter: item.spawter_display_name,
                        place: item.place_name,
                      })}
                </Text>
                {item.kind === "review" && item.note_etoiles ? (
                  <View style={{ marginTop: 2 }}>
                    <Stars value={item.note_etoiles} size="sm" />
                  </View>
                ) : null}
                {item.kind === "review" && item.texte_avis ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      ...theme.typography.preset.small,
                      color: theme.colors.text.secondary,
                      marginTop: 2,
                    }}
                  >
                    {item.texte_avis}
                  </Text>
                ) : null}
                <Text
                  style={{
                    ...theme.typography.preset.caption,
                    color: theme.colors.text.secondary,
                    marginTop: 2,
                  }}
                >
                  {item.place_neighborhood} ·{" "}
                  {new Date(item.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
