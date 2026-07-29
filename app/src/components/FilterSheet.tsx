// Story 3.5 — Bottom sheet de filtres avancés.
// Multi-select chips Cuisine + Budget, single-select Distance + Note minimale,
// CTA "Voir N spots" live count.

import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { Chip } from "./primitives/Chip";
import { Ico } from "./primitives/Ico";
import type { SearchFilters } from "../lib/search";

interface Props {
  visible: boolean;
  initialFilters: SearchFilters;
  resultsCount: (filters: SearchFilters) => number;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
}

const CUISINE_OPTIONS = [
  "ivoirienne",
  "ouest_africaine",
  "francaise",
  "italienne",
  "asiatique",
  "libanaise",
  "fusion",
  "burger_pizza",
  "patisserie",
  "cafe",
];

const DISTANCE_OPTIONS: ReadonlyArray<number | null> = [null, 1, 2, 5, 10, 20];
const RATING_OPTIONS: ReadonlyArray<number | null> = [null, 3.0, 3.5, 4.0, 4.5];

export function FilterSheet({
  visible,
  initialFilters,
  resultsCount,
  onApply,
  onClose,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SearchFilters>(initialFilters);

  // Réinitialise le draft uniquement quand la sheet (re)devient visible —
  // pas quand `initialFilters` change de référence pendant qu'elle est ouverte
  // (sinon chaque re-render parent reset le draft mid-edit). Le ref garde la
  // valeur courante d'initialFilters sans déclencher l'effet.
  const initialFiltersRef = useRef(initialFilters);
  initialFiltersRef.current = initialFilters;
  useEffect(() => {
    if (visible) setDraft(initialFiltersRef.current);
  }, [visible]);

  const toggleCuisine = (c: string) => {
    setDraft((prev) => ({
      ...prev,
      cuisines: prev.cuisines.includes(c)
        ? prev.cuisines.filter((x) => x !== c)
        : [...prev.cuisines, c],
    }));
  };
  const toggleBudget = (tier: 1 | 2 | 3) => {
    setDraft((prev) => ({
      ...prev,
      budgetTiers: prev.budgetTiers.includes(tier)
        ? prev.budgetTiers.filter((x) => x !== tier)
        : [...prev.budgetTiers, tier],
    }));
  };
  const setDistance = (km: number | null) => {
    setDraft((prev) => ({ ...prev, distanceKm: km }));
  };
  const setRating = (r: number | null) => {
    setDraft((prev) => ({ ...prev, minRating: r }));
  };
  const clearAll = () => {
    setDraft({
      cuisines: [],
      budgetTiers: [],
      distanceKm: null,
      minRating: null,
    });
  };

  const count = resultsCount(draft);
  const ctaLabel =
    count === 0
      ? t("search.filters_cta_see_zero")
      : count === 1
        ? t("search.filters_cta_see_one")
        : t("search.filters_cta_see", { count });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay.modal,
          justifyContent: "flex-end",
        }}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: theme.colors.surface.base,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            maxHeight: "85%",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: theme.spacing.lg,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.h2,
                color: theme.colors.text.primary,
              }}
            >
              {t("search.filters_open")}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "flex-end" }}
            >
              <Ico name="close" size={22} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            {/* Cuisine */}
            <View>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {t("search.filters_section_cuisine")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: theme.spacing.sm,
                }}
              >
                {CUISINE_OPTIONS.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    variant="dark"
                    selected={draft.cuisines.includes(c)}
                    onPress={() => toggleCuisine(c)}
                  />
                ))}
              </View>
            </View>

            {/* Budget */}
            <View>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {t("search.filters_section_budget")}
              </Text>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <Chip
                  label={t("search.budget_low")}
                  variant="dark"
                  selected={draft.budgetTiers.includes(1)}
                  onPress={() => toggleBudget(1)}
                />
                <Chip
                  label={t("search.budget_mid")}
                  variant="dark"
                  selected={draft.budgetTiers.includes(2)}
                  onPress={() => toggleBudget(2)}
                />
                <Chip
                  label={t("search.budget_high")}
                  variant="dark"
                  selected={draft.budgetTiers.includes(3)}
                  onPress={() => toggleBudget(3)}
                />
              </View>
            </View>

            {/* Distance */}
            <View>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {t("search.filters_section_distance")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: theme.spacing.sm,
                }}
              >
                {DISTANCE_OPTIONS.map((km) => (
                  <Chip
                    key={`d-${km ?? "any"}`}
                    label={
                      km === null
                        ? t("search.distance_off")
                        : t("search.distance_unit", { km })
                    }
                    variant="dark"
                    selected={draft.distanceKm === km}
                    onPress={() => setDistance(km)}
                  />
                ))}
              </View>
            </View>

            {/* Note minimale */}
            <View>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {t("search.filters_section_rating")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: theme.spacing.sm,
                }}
              >
                {RATING_OPTIONS.map((r) => (
                  <Chip
                    key={`r-${r ?? "any"}`}
                    label={
                      r === null
                        ? t("search.distance_off")
                        : t("search.rating_min", { value: r })
                    }
                    variant="dark"
                    selected={draft.minRating === r}
                    onPress={() => setRating(r)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {/* CTAs bas */}
          <View
            style={{
              flexDirection: "row",
              gap: theme.spacing.base,
              padding: theme.spacing.lg,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border.subtle,
            }}
          >
            <Pressable
              onPress={clearAll}
              accessibilityRole="button"
              accessibilityLabel={t("search.filters_clear_all")}
              style={({ pressed }) => ({
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.base,
                borderRadius: theme.radius.full,
                opacity: pressed ? 0.7 : 1,
                minHeight: 44,
                justifyContent: "center",
              })}
            >
              <Text
                style={{
                  ...theme.typography.preset.body,
                  color: theme.colors.text.secondary,
                }}
              >
                {t("search.filters_clear_all")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onApply(draft)}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: theme.colors.brand.accent,
                paddingVertical: theme.spacing.base,
                borderRadius: theme.radius.full,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.inverse,
                  textTransform: "none",
                }}
              >
                {ctaLabel}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
