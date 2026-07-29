// Story 3.4 — AdnTags : affichage ADN d'un lieu en chips (pas radar).
// UX spec §1329 — Component Strategy : signal rapide « Local + Établi + Premium »
// vs effort cognitif d'un radar. Radar réservé fiche spawter (Story 5.3).

import { View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Chip } from "./primitives/Chip";
import { ADN_AXIS_LABELS, type PlaceAdn } from "../types/place";

interface Props {
  adn: PlaceAdn;
  /** Optionnel — seuil de polarité (défaut: 0.5). Axe |valeur| < threshold = ambigu, pas de chip. */
  threshold?: number;
}

const ADN_KEY_MAP: Record<keyof typeof ADN_AXIS_LABELS, keyof PlaceAdn> = {
  local_international: "axe_local_international",
  informel_etabli: "axe_informel_etabli",
  budget_premium: "axe_budget_premium",
  populaire_prive: "axe_populaire_prive",
  decontracte_habille: "axe_decontracte_habille",
};

export function AdnTags({ adn, threshold = 0.5 }: Props) {
  const theme = useTheme();

  const labels: Array<{ key: string; label: string; positive: boolean }> = [];
  for (const [axisKey, descriptor] of Object.entries(ADN_AXIS_LABELS)) {
    const dbKey = ADN_KEY_MAP[axisKey as keyof typeof ADN_AXIS_LABELS];
    const value = adn[dbKey] as number;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (Math.abs(value) < threshold) continue;
    labels.push({
      key: axisKey,
      label: value > 0 ? descriptor.positivePole : descriptor.negativePole,
      positive: value > 0,
    });
  }

  if (labels.length === 0) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
      }}
    >
      {labels.map((tag) => (
        <Chip
          key={tag.key}
          label={tag.label}
          variant={tag.positive ? "dark" : "gold"}
        />
      ))}
    </View>
  );
}
