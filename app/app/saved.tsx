// Story 3.6 — Écran « Mes spots » (favoris).
// Liste les lieux sauvegardés par le spawter. Tap → fiche lieu (ref=direct V1).
// Tap heart → toggleSaved retire le favori, la carte disparaît.

import { useMemo } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { usePlaces } from "../src/lib/use-places";
import { DataLoadNotice } from "../src/components/DataLoadNotice";
import { useTheme } from "../src/theme/ThemeProvider";
import { useSpawterStore } from "../src/store/spawter-store";
import { EmptyState } from "../src/components/EmptyState";
import { ListeCard } from "../src/components/ListeCard";
import { Ico } from "../src/components/primitives/Ico";
import { track } from "../src/lib/analytics";

export default function SavedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);
  const savedUnavailable = useSpawterStore((s) => s.savedUnavailable);
  const refreshSaved = useSpawterStore((s) => s.refreshSaved);
  const toggleSaved = useSpawterStore((s) => s.toggleSaved);

  const { places, loading, failed, reload } = usePlaces();



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
          style={{ minWidth: 44, minHeight: 44, flexShrink: 0, justifyContent: "center" }}
        >
          <Ico name="arrow-left" size={22} />
        </Pressable>
        <Text
          style={{
            ...theme.typography.preset.h1,
            color: theme.colors.text.primary,
            flex: 1,
            minWidth: 0,
          }}
        >
          {t("saved.title")}
        </Text>
      </View>

      <DataLoadNotice loading={loading} failed={failed} onRetry={() => void reload()} />
      {savedUnavailable && (
        <View style={{ padding: theme.spacing.base, gap: theme.spacing.sm }}>
          <Text accessibilityRole="alert" style={{ color: theme.colors.text.primary }}>
            {t("saved.unavailable")}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("saved.retry")} onPress={() => {
            void refreshSaved().catch(() => Alert.alert(t("saved.unavailable")));
          }}>
            <Text style={{ color: theme.colors.brand.accent }}>{t("saved.retry")}</Text>
          </Pressable>
        </View>
      )}
      {saved.length === 0 && !savedUnavailable && !loading && !failed ? (
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
                }).catch(() => Alert.alert(t("saved.save_failed")));
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
