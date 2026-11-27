// Story 3.3c — FeuilletonRow : liste verticale numérotée du feed (sous le carrousel).
// Compose ListeCard pour le feed personnalisé. Variant léger avec numéro à gauche.

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { ListeCard } from "./ListeCard";
import type { PlaceWithScore } from "../lib/matching";
import type { PlaceActivityMap } from "../lib/place-activity";

const PAGE_SIZE = 12;

interface Props {
  places: readonly PlaceWithScore[];
  onPlacePress: (place: PlaceWithScore) => void;
  /** Décalage de numérotation ; l’Accueil complet passe explicitement 1. */
  startIndex?: number;
  /** Pastilles événements/promos par lieu (0049/0050), chargées par LOT en
   *  amont. Absente/vide → rendu strictement identique (flag off). */
  activity?: PlaceActivityMap | undefined;
}

export function FeuilletonRow({ places, onPlacePress, startIndex = 4, activity }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  if (places.length === 0) return null;
  return (
    <View>
      {places.slice(0, visibleCount).map((p, i) => {
        const num = (startIndex + i).toString().padStart(2, "0");
        return (
          <View
            key={p.place.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.sm,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.h2,
                color: theme.colors.brand.primary,
                width: 36,
                textAlign: "right",
              }}
            >
              {num}
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ListeCard
                place={{
                  ...p.place,
                  adn: p.adn,
                  // `rating_display` est dénormalisé Sprint 2 (Story 4.x). En
                  // attendant on dérive depuis le rating pondéré ADN — info la
                  // plus proche déjà disponible côté client.
                  rating_display: p.adn.total_reviews > 0 ? p.adn.weighted_rating : 0,
                  // Préserve `total_spawts` du place source plutôt que de
                  // hardcoder 0. `PlaceWithScore.place` est typé `Place` (qui
                  // n'a pas total_spawts) mais le feed l'alimente toujours
                  // depuis un `PlaceWithAdn` upstream — narrow runtime safe.
                  total_spawts:
                    (p.place as { total_spawts?: number }).total_spawts ?? 0,
                }}
                onPress={() => onPlacePress(p)}
                activity={activity?.[p.place.id]}
              />
            </View>
          </View>
        );
      })}
      {places.length > visibleCount && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisibleCount(count => count + PAGE_SIZE)}
          style={{
            alignSelf: "center",
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: theme.spacing.base,
            marginVertical: theme.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            borderRadius: theme.radius.full,
          }}
        >
          <Text style={{ ...theme.typography.preset.body, color: theme.colors.brand.accent }}>
            {t("home.more_addresses")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
