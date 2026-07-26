// Progression complète — badges 30+, cartes collector, paws, défis collectifs
// (features post-MVP #10, #5, #13, #14 — migrations 0035-0037 + 0040).
//
// Chaque section vit derrière SON flag (`badges-v2`, `collectibles`, `paws`,
// `defis-collectifs`), tous OFF par défaut (seed v2) → non-régression stricte.
// Aucun flag actif → redirect feed (défense en profondeur, pattern rapide).
//
// ⚠️ Contrat SPAWT (PRD §19/§20.1) : progression PERSONNELLE, défis
// COLLECTIFS — cet écran ne compare jamais deux spawters.

import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { Ico } from "../src/components/primitives/Ico";
import { BadgesSection } from "../src/components/progression/BadgesSection";
import { CollectionSection } from "../src/components/progression/CollectionSection";
import { DefisSection } from "../src/components/progression/DefisSection";
import { PawsSection } from "../src/components/progression/PawsSection";
import { buildProgressionSummary } from "../src/lib/progression-engine";
import { useProgressionStore } from "../src/store/progression-store";
import { useSpawterStore } from "../src/store/spawter-store";
import { useFlag } from "../src/store/feature-flags";
import { track } from "../src/lib/analytics";

export default function ProgressionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  // Tous les hooks AVANT tout early return (leçon R22 — rules of hooks).
  const badgesEnabled = useFlag("badges-v2");
  const collectiblesEnabled = useFlag("collectibles");
  const pawsEnabled = useFlag("paws");
  const defisEnabled = useFlag("defis-collectifs");
  const anyEnabled = badgesEnabled || collectiblesEnabled || pawsEnabled || defisEnabled;

  const spawter = useSpawterStore((s) => s.spawter);
  const spawts = useSpawterStore((s) => s.spawts);

  const hydrated = useProgressionStore((s) => s.hydrated);
  const badges = useProgressionStore((s) => s.badges);
  const cards = useProgressionStore((s) => s.cards);
  const pawsBalance = useProgressionStore((s) => s.pawsBalance);
  const pawsLedger = useProgressionStore((s) => s.pawsLedger);
  const streak = useProgressionStore((s) => s.streak);
  const challenges = useProgressionStore((s) => s.challenges);
  const hydrate = useProgressionStore((s) => s.hydrate);
  const runBadgeCheck = useProgressionStore((s) => s.runBadgeCheck);
  const toggleBadgeDisplayed = useProgressionStore((s) => s.toggleBadgeDisplayed);

  const spawterId = spawter?.id ?? null;
  useEffect(() => {
    if (!anyEnabled || !spawterId) return;
    void hydrate(spawterId);
    // Rattrapage best-effort : des badges gagnés hors-app (triggers SQL)
    // apparaissent à l'ouverture de l'écran — jamais bloquant.
    if (badgesEnabled) void runBadgeCheck(spawterId);
    track({ name: "progression_opened", properties: {} });
  }, [anyEnabled, badgesEnabled, spawterId, hydrate, runBadgeCheck]);

  if (!anyEnabled || !spawter) {
    return <Redirect href="/(tabs)" />;
  }

  const summary = buildProgressionSummary({
    spawter,
    spawts,
    badges: badges ?? { catalogue: [], unlocked: [] },
    cards,
    pawsBalance,
    pawsLedger,
    streak,
    challenges,
  });

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
          {t("progression.title")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.xl,
          paddingBottom: theme.spacing["2xl"],
        }}
      >
        <Text
          style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}
        >
          {t("progression.subtitle")}
        </Text>

        {/* Stade — réutilise stade-progress tel quel (Story 5.4). */}
        <View
          testID="progression-stade-section"
          style={{
            padding: theme.spacing.base,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surface.subtle,
            gap: theme.spacing.sm,
          }}
        >
          <Text
            style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}
          >
            {t("progression.stade_label")}
          </Text>
          <Text style={{ ...theme.typography.preset.h2, color: theme.colors.brand.primary }}>
            {t(`stade.${summary.stade.current_stade}`)}
          </Text>
          <View
            style={{
              height: 6,
              backgroundColor: theme.colors.border.subtle,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <View
              testID="progression-stade-bar"
              style={{
                width: `${Math.round(summary.stade.percent * 100)}%`,
                height: "100%",
                backgroundColor: theme.colors.brand.primary,
              }}
            />
          </View>
          <Text style={{ ...theme.typography.preset.data, color: theme.colors.text.secondary }}>
            {summary.stade.next_stade
              ? t("progression.stade_progress", {
                  current: summary.stade.current_count,
                  threshold: summary.stade.next_threshold ?? 0,
                  stade: t(`stade.${summary.stade.next_stade}`),
                })
              : t("progression.stade_max")}
          </Text>
        </View>

        {!hydrated ? (
          <Text
            style={{ ...theme.typography.preset.body, color: theme.colors.text.tertiary }}
          >
            {t("common.loading")}
          </Text>
        ) : (
          <>
            {badgesEnabled ? (
              <BadgesSection
                badges={summary.badges}
                onToggleDisplayed={toggleBadgeDisplayed}
              />
            ) : null}

            {collectiblesEnabled ? <CollectionSection cards={cards} /> : null}

            {defisEnabled ? (
              <DefisSection challenges={challenges} streak={streak} />
            ) : null}

            {pawsEnabled ? (
              <PawsSection balance={pawsBalance} ledger={pawsLedger} />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
