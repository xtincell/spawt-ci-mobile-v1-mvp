// La Bande V1.5 — public community activity; private Crew remains secondary.

import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../src/theme/ThemeProvider";
import { DataSourceBanner } from "../../src/components/DataSourceBanner";
import { EmptyState } from "../../src/components/EmptyState";
import { CommunityActivityCard } from "../../src/components/CommunityActivityCard";
import { useCommunityFeed } from "../../src/lib/use-community-feed";
import type { CommunityFilter } from "../../src/lib/community";
import { DataLoadNotice } from "../../src/components/DataLoadNotice";
import { Ico } from "../../src/components/primitives/Ico";
import { normalizeCrewInviteCode } from "../../src/lib/share-links";
import { CrewBlock } from "../../src/components/crew/CrewBlock";
import { track } from "../../src/lib/analytics";
import { useFlag } from "../../src/store/feature-flags";

export default function MeuteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const crewEnabled = useFlag("mode-crew");
  const { crewCode } = useLocalSearchParams<{ crewCode?: string | string[] }>();
  const inviteCode = normalizeCrewInviteCode(crewCode);
  const [crewExpanded, setCrewExpanded] = useState(Boolean(inviteCode));
  useEffect(() => {
    if (inviteCode) setCrewExpanded(true);
  }, [inviteCode]);
  const feed = useCommunityFeed();
  const { items, loading, failed } = feed;
  const filters = useRef<ScrollView>(null);
  const filterWidth = useRef(0);
  const filterBounds = useRef<
    Partial<Record<CommunityFilter, { x: number; width: number }>>
  >({});
  const revealFilter = (value = feed.filter) => {
    const bounds = filterBounds.current[value];
    if (bounds)
      filters.current?.scrollTo({
        x: Math.max(0, bounds.x - (filterWidth.current - bounds.width) / 2),
        animated: false,
      });
  };
  useEffect(() => {
    track({ name: "feed_viewed", properties: { surface: "meute" } });
  }, []);
  const empty = !loading && !failed && items.length === 0;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <DataSourceBanner />
      <FlatList
        testID="community-feed"
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={feed.refresh}
          />
        }
        ListHeaderComponent={
          <View
            style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.base }}
          >
            <Text
              accessibilityRole="header"
              style={{
                ...theme.typography.preset.h1,
                color: theme.colors.text.primary,
              }}
            >
              {t("meute.title")}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.secondary,
              }}
            >
              {t("meute.subtitle")}
            </Text>
            <ScrollView
              ref={filters}
              horizontal
              showsHorizontalScrollIndicator={false}
              testID="community-filters"
              accessibilityRole="radiogroup"
              onLayout={(event) => {
                filterWidth.current = event.nativeEvent.layout.width;
                revealFilter();
              }}
              onContentSizeChange={() => revealFilter()}
              contentContainerStyle={{ gap: theme.spacing.sm }}
            >
              {(["all", "review", "coup"] as CommunityFilter[]).map((value) => (
                <Pressable
                  key={value}
                  testID={`community-filter-${value}`}
                  accessibilityRole="radio"
                  aria-checked={feed.filter === value}
                  accessibilityState={{ checked: feed.filter === value }}
                  onPress={() => {
                    feed.selectFilter(value);
                    revealFilter(value);
                  }}
                  onFocus={() => revealFilter(value)}
                  onLayout={(event) => {
                    filterBounds.current[value] = event.nativeEvent.layout;
                    if (feed.filter === value) revealFilter(value);
                  }}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    paddingHorizontal: theme.spacing.base,
                    borderRadius: theme.radius.full,
                    backgroundColor:
                      feed.filter === value
                        ? theme.colors.surface.inverse
                        : theme.colors.surface.subtle,
                  }}
                >
                  <Text
                    style={{
                      ...theme.typography.preset.small,
                      color:
                        feed.filter === value
                          ? theme.colors.text.inverse
                          : theme.colors.text.primary,
                    }}
                  >
                    {t(`meute.filter_${value}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {crewEnabled ? (
              <>
                <Pressable
                  testID="crew-toggle"
                  accessibilityRole="button"
                  aria-expanded={crewExpanded}
                  accessibilityState={{ expanded: crewExpanded }}
                  onPress={() => setCrewExpanded((value) => !value)}
                  style={{
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: theme.spacing.sm,
                  }}
                >
                  <Ico
                    name="users"
                    size={20}
                    color={theme.colors.brand.primary}
                  />
                  <Text
                    style={{
                      ...theme.typography.preset.small,
                      flex: 1,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {t("meute.crew_toggle")}
                  </Text>
                  <View
                    style={{
                      transform: [{ rotate: crewExpanded ? "180deg" : "0deg" }],
                    }}
                  >
                    <Ico name="chevron-down" size={16} />
                  </View>
                </Pressable>
                {crewExpanded ? (
                  <>
                    <Text
                      style={{
                        ...theme.typography.preset.small,
                        color: theme.colors.text.secondary,
                      }}
                    >
                      {t("meute.crew_context")}
                    </Text>
                    <CrewBlock />
                  </>
                ) : null}
              </>
            ) : null}
            <DataLoadNotice
              loading={loading}
              failed={failed}
              onRetry={feed.refresh}
            />
          </View>
        }
        ListEmptyComponent={
          empty ? (
            <EmptyState
              icon="compass"
              title={t("empty_state.meute_title")}
              body={t("meute.empty_body")}
              cta={{
                label: t("meute.contribute"),
                onPress: () => router.push("/(tabs)/spawter"),
              }}
            />
          ) : null
        }
        ListFooterComponent={
          feed.hasMore ? (
            <View>
              {feed.moreFailed ? (
                <DataLoadNotice
                  failed
                  loading={false}
                  onRetry={feed.loadMore}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                testID="community-load-more"
                disabled={loading || feed.more}
                accessibilityState={{ disabled: loading || feed.more }}
                onPress={feed.loadMore}
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: theme.spacing.sm,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.primary,
                  }}
                >
                  {t(feed.more ? "meute.loading_more" : "meute.load_more")}
                </Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => <CommunityActivityCard item={item} />}
      />
    </SafeAreaView>
  );
}
