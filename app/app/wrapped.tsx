// SPAWT Wrapped — « ton année avec la Meute » (post-MVP #11/#15).
// Slides horizontales snap (pagingEnabled) : chiffres de l'année, identité,
// badges — et carte finale 9:16 noir/or partageable (ShareCard + capture).
//
// Flag `wrapped` OFF par défaut (seed v2) → redirect feed (défense en
// profondeur, pattern rapide). Données : Edge `wrapped-stats` best-effort en
// mode supabase (null → état d'attente sobre), fixture vivante en démo.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { gradient } from "../src/theme/tokens";
import { Ico } from "../src/components/primitives/Ico";
import { ShareCard, type ShareCardStat } from "../src/components/share/ShareCard";
import { getWrappedStats } from "../src/lib/data-source";
import { wrappedYearFor, type WrappedResult } from "../src/lib/wrapped";
import { captureAndShareView } from "../src/lib/share-card";
import { useSpawterStore } from "../src/store/spawter-store";
import { useFlag } from "../src/store/feature-flags";
import { track } from "../src/lib/analytics";
import { ARCHETYPES } from "../src/data/archetypes";
import { isArchetypeKey } from "../src/lib/archetype-engine";
import type { View as RNView } from "react-native";

export default function WrappedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  // Tous les hooks AVANT tout early return (leçon R22 — rules of hooks).
  const enabled = useFlag("wrapped");
  const spawter = useSpawterStore((s) => s.spawter);
  const [result, setResult] = useState<WrappedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const shareRef = useRef<RNView>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const r = await getWrappedStats(wrappedYearFor());
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    })();
    track({ name: "wrapped_opened", properties: { year: wrappedYearFor() } });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || !spawter) {
    return <Redirect href="/(tabs)" />;
  }

  const stats = result?.stats ?? null;
  const year = result?.year ?? wrappedYearFor();

  // Archétype : la réponse serveur prime, sinon celui du store (démo/local).
  const archetypeKey = stats?.archetype ?? spawter.quiz_archetype ?? null;
  const archetypeName =
    archetypeKey && isArchetypeKey(archetypeKey)
      ? t(ARCHETYPES[archetypeKey].nameKey)
      : null;

  const onShare = async () => {
    track({ name: "share_initiated", properties: { surface: "wrapped", year } });
    const shared = await captureAndShareView(
      shareRef.current,
      t("wrapped.share_dialog_title"),
    );
    if (shared) {
      track({ name: "wrapped_shared", properties: { year } });
    }
  };

  // ── Slides — seules les stats présentes racontent (best-effort serveur). ──
  const slides: { key: string; kicker: string; value: string; caption: string }[] = [];
  if (stats) {
    if (stats.total_spawts !== null) {
      slides.push({
        key: "spawts",
        kicker: t("wrapped.slide_spawts_kicker"),
        value: String(stats.total_spawts),
        caption: t("wrapped.slide_spawts_caption", { count: stats.total_spawts }),
      });
    }
    if (stats.unique_places !== null) {
      slides.push({
        key: "places",
        kicker: t("wrapped.slide_places_kicker"),
        value: String(stats.unique_places),
        caption: t("wrapped.slide_places_caption", {
          count: stats.communes_count ?? 0,
        }),
      });
    }
    if (stats.top_cuisine) {
      slides.push({
        key: "cuisine",
        kicker: t("wrapped.slide_cuisine_kicker"),
        value: t(`cuisine.${stats.top_cuisine}`, stats.top_cuisine),
        caption: t("wrapped.slide_cuisine_caption"),
      });
    }
    if (stats.top_place) {
      slides.push({
        key: "place",
        kicker: t("wrapped.slide_top_place_kicker"),
        value: stats.top_place.name,
        caption: t("wrapped.slide_top_place_caption", {
          count: stats.top_place.count,
        }),
      });
    }
    if (stats.avg_note !== null) {
      slides.push({
        key: "note",
        kicker: t("wrapped.slide_note_kicker"),
        value: `${stats.avg_note}`,
        caption: t("wrapped.slide_note_caption"),
      });
    }
    if (archetypeName) {
      slides.push({
        key: "identity",
        kicker: t("wrapped.slide_identity_kicker"),
        value: archetypeName,
        caption:
          stats.pionnier_seq !== null
            ? t("wrapped.slide_identity_pionnier", { n: stats.pionnier_seq })
            : t("wrapped.slide_identity_caption"),
      });
    }
    if (stats.badges_unlocked && stats.badges_unlocked.length > 0) {
      slides.push({
        key: "badges",
        kicker: t("wrapped.slide_badges_kicker"),
        value: String(stats.badges_unlocked.length),
        caption: t("wrapped.slide_badges_caption", {
          count: stats.badges_unlocked.length,
        }),
      });
    }
  }

  const shareStats: ShareCardStat[] = [];
  if (stats?.total_spawts !== null && stats?.total_spawts !== undefined) {
    shareStats.push({
      label: t("wrapped.card_stat_spawts"),
      value: String(stats.total_spawts),
    });
  }
  if (stats?.unique_places !== null && stats?.unique_places !== undefined) {
    shareStats.push({
      label: t("wrapped.card_stat_places"),
      value: String(stats.unique_places),
    });
  }
  if (stats?.communes_count !== null && stats?.communes_count !== undefined) {
    shareStats.push({
      label: t("wrapped.card_stat_communes"),
      value: String(stats.communes_count),
    });
  }
  if (stats?.top_cuisine) {
    shareStats.push({
      label: t("wrapped.card_stat_cuisine"),
      value: t(`cuisine.${stats.top_cuisine}`, stats.top_cuisine),
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradient.night} style={{ position: "absolute", inset: 0 }} />
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: theme.spacing.base,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.brand.primary,
            }}
          >
            {t("wrapped.title", { year })}
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ico name="close" size={22} color={theme.colors.text.inverse} />
          </Pressable>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={theme.colors.brand.primary} />
          </View>
        ) : slides.length === 0 ? (
          // Best-effort intégral : rien à raconter (aucun agrégat) → le Chat
          // reste digne, pas d'écran cassé.
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: theme.spacing.xl,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.inverse,
                textAlign: "center",
              }}
            >
              {t("wrapped.empty_body")}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            testID="wrapped-slides"
          >
            {/* Slide d'ouverture. */}
            <Slide width={width}>
              <Text
                style={{
                  ...theme.typography.preset.display,
                  color: theme.colors.brand.primary,
                  textAlign: "center",
                }}
              >
                {t("wrapped.intro_title", { year })}
              </Text>
              <Text
                style={{
                  ...theme.typography.preset.body,
                  color: theme.colors.text.inverseSecondary,
                  textAlign: "center",
                  marginTop: theme.spacing.base,
                }}
              >
                {t("wrapped.intro_body")}
              </Text>
              <View style={{ marginTop: theme.spacing.xl, alignItems: "center" }}>
                <Ico name="arrow-right" size={22} color={theme.colors.text.inverseSecondary} />
              </View>
            </Slide>

            {slides.map((slide) => (
              <Slide key={slide.key} width={width} testID={`wrapped-slide-${slide.key}`}>
                <Text
                  style={{
                    ...theme.typography.preset.overline,
                    color: theme.colors.text.inverseSecondary,
                    textAlign: "center",
                  }}
                >
                  {slide.kicker}
                </Text>
                <Text
                  style={{
                    ...theme.typography.preset.display,
                    color: theme.colors.brand.primary,
                    textAlign: "center",
                    marginTop: theme.spacing.base,
                  }}
                >
                  {slide.value}
                </Text>
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.inverse,
                    textAlign: "center",
                    marginTop: theme.spacing.base,
                  }}
                >
                  {slide.caption}
                </Text>
              </Slide>
            ))}

            {/* Slide finale — carte 9:16 + partage. */}
            <Slide width={width} testID="wrapped-slide-final">
              <ShareCard
                ref={shareRef}
                kicker={t("wrapped.card_kicker", { year })}
                headline={archetypeName ?? t("wrapped.card_headline_fallback")}
                subline={spawter.display_name}
                stats={shareStats}
                archetype={archetypeKey}
                footer={
                  stats?.pionnier_seq !== null && stats?.pionnier_seq !== undefined
                    ? t("wrapped.card_pionnier", { n: stats.pionnier_seq })
                    : undefined
                }
              />
              <Pressable
                onPress={() => {
                  void onShare();
                }}
                accessibilityRole="button"
                accessibilityLabel={t("wrapped.share_cta")}
                testID="wrapped-share-cta"
                style={({ pressed }) => ({
                  backgroundColor: theme.colors.brand.primary,
                  paddingHorizontal: theme.spacing.xl,
                  paddingVertical: theme.spacing.base,
                  borderRadius: theme.radius.full,
                  marginTop: theme.spacing.lg,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{ ...theme.typography.preset.h3, color: theme.colors.text.onBrand }}
                >
                  {t("wrapped.share_cta")}
                </Text>
              </Pressable>
            </Slide>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function Slide({
  width,
  children,
  testID,
}: {
  width: number;
  children: React.ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={{
        width,
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing.xl,
      }}
    >
      {children}
    </View>
  );
}
