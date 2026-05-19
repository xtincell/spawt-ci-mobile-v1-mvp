// Story 3.5 — FilterChips horizontaux scrollable.
// Affiche les filtres actifs en chips (toggle off au tap) + chip permanente
// « + Filtres » qui ouvre le FilterSheet (callback prop `onOpenSheet`).

import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { Chip } from "./primitives/Chip";
import type { SearchFilters } from "../lib/search";

export type FilterKind = "cuisine" | "budget" | "distance" | "rating";

interface Props {
  filters: SearchFilters;
  onToggle: (kind: FilterKind, value: unknown) => void;
  onOpenSheet: () => void;
}

const BUDGET_LABELS: Record<1 | 2 | 3, string> = {
  1: "₣",
  2: "₣₣",
  3: "₣₣₣",
};

export function FilterChips({ filters, onToggle, onOpenSheet }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.base,
        alignItems: "center",
      }}
    >
      <Chip
        label={`+ ${t("search.filters_button")}`}
        variant="outline"
        onPress={onOpenSheet}
      />
      {filters.cuisines.map((c) => (
        <Chip
          key={`cuisine-${c}`}
          label={c}
          variant="dark"
          selected
          onPress={() => onToggle("cuisine", c)}
        />
      ))}
      {filters.budgetTiers.map((tier) => (
        <Chip
          key={`budget-${tier}`}
          label={BUDGET_LABELS[tier]}
          variant="dark"
          selected
          onPress={() => onToggle("budget", tier)}
        />
      ))}
      {filters.distanceKm !== null ? (
        <Chip
          label={t("search.distance_unit", { km: filters.distanceKm })}
          variant="dark"
          selected
          onPress={() => onToggle("distance", null)}
        />
      ) : null}
      {filters.minRating !== null ? (
        <Chip
          label={t("search.rating_min", { value: filters.minRating })}
          variant="dark"
          selected
          onPress={() => onToggle("rating", null)}
        />
      ) : null}
      <View style={{ width: theme.spacing.base }} />
    </ScrollView>
  );
}
