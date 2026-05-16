// Carte d'un lieu dans le feed (PRD §3.1 Feature 3, §6.3 signaux).

import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import type { PlaceWithAdn } from "../lib/data-source";

interface Props {
  place: PlaceWithAdn;
  matchScore: number; // 50-99 (PRD §8.3)
  distanceKm: number;
  onPress: () => void;
}

const SIGNAL_LABELS: Record<string, string> = {
  coup_de_coeur: "❤️ Coup de Cœur",
  pepite_verifiee: "💎 Pépite vérifiée",
  institution: "👑 Institution",
  fidelite: "🔁 Fidélité",
  decouverte: "🌱 Découverte",
  table_diverse: "🌍 Table diverse",
  noctambule_verifie: "🌙 Noctambule",
};

const PRICE_TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "₣",
  2: "₣₣",
  3: "₣₣₣",
};

export function PlaceCard({ place, matchScore, distanceKm, onPress }: Props) {
  const theme = useTheme();
  const adnReady = place.adn.confidence_score >= 0.3;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface.raised,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.base,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
        marginBottom: theme.spacing.base,
      })}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, score ${matchScore}%`}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {place.name}
          </Text>
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: theme.typography.size.sm,
              marginBottom: theme.spacing.xs,
            }}
            numberOfLines={1}
          >
            {place.location.neighborhood} · {place.cuisine.slice(0, 2).join(" · ")}
          </Text>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <Pill label={`${matchScore}%`} bg={theme.colors.brand.accent} fg={theme.colors.text.inverse} bold />
            <Pill label={`${distanceKm.toFixed(1)} km`} bg={theme.colors.surface.subtle} fg={theme.colors.text.primary} />
            <Pill label={`★ ${place.rating_display.toFixed(1)}`} bg={theme.colors.surface.subtle} fg={theme.colors.text.primary} />
            <Pill label={PRICE_TIER_LABELS[place.price.tier]} bg={theme.colors.surface.subtle} fg={theme.colors.text.primary} />
          </View>
        </View>
      </View>

      {place.signals.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
          {place.signals.map((s) => (
            <Text
              key={s}
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.size.xs,
                backgroundColor: theme.colors.surface.subtle,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 2,
                borderRadius: theme.radius.full,
              }}
            >
              {SIGNAL_LABELS[s] ?? s}
            </Text>
          ))}
        </View>
      )}

      {!adnReady && (
        <Text
          style={{
            color: theme.colors.text.tertiary,
            fontSize: theme.typography.size.xs,
            marginTop: theme.spacing.sm,
            fontStyle: "italic",
          }}
        >
          ADN en construction
        </Text>
      )}
    </Pressable>
  );
}

function Pill({ label, bg, fg, bold }: { label: string; bg: string; fg: string; bold?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: fg, fontSize: 12, fontWeight: bold ? "700" : "500" }}>{label}</Text>
    </View>
  );
}
