// Mode Explore — liste des carnets éditoriaux (feature post-MVP #3).
//
// Derrière le flag `mode-explore` (seed V2, OFF par défaut) : flag off →
// entrée hub masquée côté feed ET deep link redirigé vers le feed ici.
//
// LECTURE seule : les collections viennent de listExploreCollections()
// (fixtures en démo, tables 0045 en live). La curation est un chantier
// admin séparé. Tap sur un carnet → app/explore/[slug].tsx.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { EmptyState } from "../src/components/EmptyState";
import { Ico } from "../src/components/primitives/Ico";
import {
  listExploreCollections,
  type ExploreCollectionSummary,
} from "../src/lib/data-source";
import { track } from "../src/lib/analytics";
import { useFlag } from "../src/store/feature-flags";

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  // Tous les hooks AVANT tout early return (leçon R22 — rules of hooks).
  const enabled = useFlag("mode-explore");
  const [collections, setCollections] = useState<ExploreCollectionSummary[] | null>(null);
  const openedTrackedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const rows = await listExploreCollections();
      if (cancelled) return;
      setCollections(rows);
      if (!openedTrackedRef.current) {
        openedTrackedRef.current = true;
        track({
          name: "explore_opened",
          properties: { collections_count: rows.length },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) {
    return <Redirect href="/(tabs)" />;
  }

  const onOpenCollection = (collection: ExploreCollectionSummary) => {
    router.push({
      pathname: "/explore/[slug]" as never,
      params: { slug: collection.slug } as never,
    });
  };

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
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.brand.primary,
            }}
          >
            {t("explore.kicker")}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.h1,
              color: theme.colors.text.primary,
            }}
          >
            {t("explore.title")}
          </Text>
        </View>
      </View>

      {collections === null ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      ) : collections.length === 0 ? (
        <EmptyState
          title={t("explore.empty_title")}
          body={t("explore.empty_body")}
        />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing["2xl"],
            gap: theme.spacing.base,
          }}
          renderItem={({ item }) => (
            <CollectionCard collection={item} onPress={() => onOpenCollection(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

/** Carte d'un carnet — cover 16/9 + scrim bas, langage visuel d'UneCard. */
function CollectionCard({
  collection,
  onPress,
}: {
  collection: ExploreCollectionSummary;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUrl = collection.cover_url ?? "";
  const hasCover = coverUrl.length > 0 && !coverFailed;
  const title = t(collection.title_key);
  const subtitle = collection.subtitle_key ? t(collection.subtitle_key) : "";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("explore.collection_open_aria", { title })}
      style={({ pressed }) => ({
        height: 160,
        borderRadius: theme.radius.card,
        overflow: "hidden",
        backgroundColor: theme.colors.surface.subtle,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {hasCover ? (
        <Image
          source={{ uri: coverUrl }}
          onError={() => setCoverFailed(true)}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.surface.inverse,
          }}
        >
          <Ico name="map" size={40} color={theme.colors.brand.primary} />
        </View>
      )}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: theme.spacing.base,
          backgroundColor: theme.colors.overlay.scrim,
        }}
      >
        <Text
          style={{
            ...theme.typography.preset.h2,
            color: theme.colors.text.inverse,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle.length > 0 ? (
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.inverseSecondary,
            }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
