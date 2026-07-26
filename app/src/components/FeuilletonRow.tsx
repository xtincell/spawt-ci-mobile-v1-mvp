// Story 3.3c — FeuilletonRow : liste verticale numérotée du feed (sous le carrousel).
// Compose ListeCard pour chaque lieu hors top 3. Variant léger avec numéro à gauche.

import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { ListeCard } from "./ListeCard";
import type { PlaceWithScore } from "../lib/matching";
import type { PlaceActivityMap } from "../lib/place-activity";

interface Props {
  places: readonly PlaceWithScore[];
  onPlacePress: (place: PlaceWithScore) => void;
  /** Décalage de numérotation (Story 3.3c — les 3 premiers sont dans le carrousel,
   *  le feuilleton commence à 04). */
  startIndex?: number;
  /** Pastilles événements/promos par lieu (0049/0050), chargées par LOT en
   *  amont. Absente/vide → rendu strictement identique (flag off). */
  activity?: PlaceActivityMap | undefined;
}

export function FeuilletonRow({ places, onPlacePress, startIndex = 4, activity }: Props) {
  const theme = useTheme();
  if (places.length === 0) return null;
  return (
    <View>
      {places.map((p, i) => {
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
            <View style={{ flex: 1 }}>
              <ListeCard
                place={{
                  ...p.place,
                  adn: p.adn,
                  // `rating_display` est dénormalisé Sprint 2 (Story 4.x). En
                  // attendant on dérive depuis le rating pondéré ADN — info la
                  // plus proche déjà disponible côté client.
                  rating_display: p.adn.weighted_rating,
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
    </View>
  );
}
