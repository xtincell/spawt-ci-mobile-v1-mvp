import { useContentRevision } from "../lib/content-sync";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useFlag } from "../store/feature-flags";
import {
  dataSourceMode,
  listExploreCollections,
  type ExploreCollectionSummary,
} from "../lib/data-source";
import { getActiveCity } from "../lib/city";
import { useNavigationAction } from "../lib/use-navigation-action";
import { track } from "../lib/analytics";
import { DataLoadNotice } from "./DataLoadNotice";
import { Ico } from "./primitives/Ico";

/** Same published collection reader for the home panel and the standalone index. */
export function ExploreCollections({
  refreshKey = 0,
  active = true,
  audience = "general",
  limit,
  preview = false,
}: {
  refreshKey?: number;
  active?: boolean;
  audience?: "general" | "duo";
  limit?: number;
  preview?: boolean;
}) {
  const contentRevision = useContentRevision();
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigationAction();
  const enabled = useFlag("mode-explore");
  const [rows, setRows] = useState<ExploreCollectionSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const opened = useRef(false);
  useEffect(() => {
    if (!enabled || !active || (preview && dataSourceMode !== "supabase")) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void listExploreCollections({ throwOnError: true })
      .then((next) => {
        if (cancelled) return;
        setRows(next.filter(c => (c.audience ?? "general") === audience));
        if (!preview && !opened.current) {
          opened.current = true;
          track({
            name: "explore_opened",
            properties: { collections_count: next.length },
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, active, refreshKey, retry, audience, contentRevision, preview]);
  function openCollection(collection: ExploreCollectionSummary) {
    navigate(() => router.push({ pathname: "/explore/[slug]", params: { slug: collection.slug } }));
  }
  if (preview) {
    if (!enabled || dataSourceMode !== "supabase" || !rows?.length) return null;
    const city = getActiveCity();
    const collection = rows.find(row => row.city_code === city.code);
    return collection ? <CollectionCard key={collection.id} collection={collection} compact onPress={() => openCollection(collection)} /> : null;
  }
  if (!enabled)
    return <PanelNotice message={t("home.collections_unavailable")} />;
  return (
    <View testID="explore-collections" style={{ gap: theme.spacing.base }}>
      <DataLoadNotice
        loading={loading}
        failed={failed}
        onRetry={() => setRetry((n) => n + 1)}
      />
      {rows?.slice(0, limit).map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onPress={() => openCollection(collection)}
        />
      ))}
      {!loading && !failed && rows?.length === 0 ? (
        <View testID="collections-empty">
          <PanelNotice message={t(audience === "duo" ? "editorial.duo_empty" : "editorial.collections_empty")} />
        </View>
      ) : null}
      {rows && rows.length > 0 ? (
        <PanelNotice message={t("home.collections_hint")} />
      ) : null}
    </View>
  );
}

export function PanelNotice({
  title,
  message,
}: {
  title?: string;
  message: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
    >
      {title ? (
        <Text
          style={{
            ...theme.typography.preset.h2,
            color: theme.colors.text.primary,
          }}
        >
          {title}
        </Text>
      ) : null}
      <Text
        style={{
          ...theme.typography.preset.body,
          color: theme.colors.text.secondary,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

export function DuoEditorial({ refreshKey = 0 }: { refreshKey?: number }) {
  return <ExploreCollections audience="duo" refreshKey={refreshKey} />;
}

function CollectionCard({
  collection,
  onPress,
  compact = false,
}: {
  collection: ExploreCollectionSummary;
  onPress: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const title = t(collection.title_key);
  const cover = collection.cover_url && collection.cover_url !== failedCover ? collection.cover_url : null;
  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("explore.collection_open_aria", { title })}
        onPress={onPress}
        style={({ pressed }) => ({
          marginHorizontal: theme.spacing.lg,
          marginVertical: theme.spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.base,
          padding: theme.spacing.base,
          borderRadius: theme.radius.card,
          backgroundColor: theme.colors.surface.inverse,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {cover ? (
          <Image source={{ uri: cover }} resizeMode="cover" onError={() => setFailedCover(cover)}
            style={{ width: 68, height: 76, borderRadius: theme.radius.md }} />
        ) : <Ico name="map" size={36} color={theme.colors.brand.primary} />}
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text style={{ ...theme.typography.preset.overline, color: theme.colors.brand.primary }}>{t("outings.editorial")}</Text>
          <Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.inverse }}>{title}</Text>
          {collection.subtitle_key ? <Text numberOfLines={2} style={{ ...theme.typography.preset.small, color: theme.colors.text.inverseSecondary }}>{t(collection.subtitle_key)}</Text> : null}
        </View>
        <Ico name="chevron-right" size={20} color={theme.colors.text.inverse} />
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("explore.collection_open_aria", { title })}
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: theme.spacing.lg,
        minHeight: 170,
        borderRadius: theme.radius.card,
        overflow: "hidden",
        backgroundColor: theme.colors.surface.inverse,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          onError={() => setFailedCover(cover)}
          style={{ width: "100%", height: 130 }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
        <Ico name="map" size={32} color={theme.colors.brand.primary} />
        <Text
          style={{
            ...theme.typography.preset.h2,
            color: theme.colors.text.inverse,
          }}
        >
          {title}
        </Text>
        {collection.subtitle_key ? (
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.inverseSecondary,
            }}
          >
            {t(collection.subtitle_key)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
