// Story 3.6 — Écran « Mes spots » (favoris).
// Liste les lieux sauvegardés par le spawter. Tap → fiche lieu (ref=direct V1).
// Tap heart → toggleSaved retire le favori, la carte disparaît.

import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { useSpawterStore } from "../src/store/spawter-store";
import { listPlaces, type PlaceWithAdn } from "../src/lib/data-source";
import { EmptyState } from "../src/components/EmptyState";
import { ListeCard } from "../src/components/ListeCard";
import { Ico } from "../src/components/primitives/Ico";
import { track } from "../src/lib/analytics";

export default function SavedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);
  const toggleSaved = useSpawterStore((s) => s.toggleSaved);

  const [places, setPlaces] = useState<PlaceWithAdn[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await listPlaces();
      if (!cancelled) setPlaces(all);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saved = useMemo(
    () => places.filter((p) => savedPlaceIds.has(p.id)),
    [places, savedPlaceIds],
  );

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
          gap: theme.spacing.base,
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
        <Text
          style={{
            ...theme.typography.preset.h1,
            color: theme.colors.text.primary,
          }}
        >
          {t("saved.title")}
        </Text>
      </View>

      {saved.length === 0 ? (
        <EmptyState
          icon="heart"
          title={t("saved.empty_title")}
          body={t("saved.empty_body")}
        />
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: theme.spacing["2xl"] }}
          renderItem={({ item }) => (
            <ListeCard
              place={item}
              onPress={() =>
                router.push({
                  pathname: "/place/[id]",
                  params: { id: item.id, ref: "direct" },
                })
              }
              onUnsave={() => {
                void toggleSaved(item.id).then(() => {
                  track({
                    name: "place_unsaved",
                    properties: { place_id: item.id },
                  });
                });
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
