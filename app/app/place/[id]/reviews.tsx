// Story 4.12 — AC #4 : écran « Tous les avis » d'un lieu.
//
// Atteint via le lien « Voir tous les avis (N) » de la fiche (PlaceReviews)
// quand le total dépasse les 5 affichés. Liste défilable de TOUS les avis
// (limite relâchée), réutilisant le composant ReviewCard partagé — pas de
// rendu d'avis dupliqué. Même filtre que la fiche (seeds inclus, badge fondateur).

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../../src/theme/ThemeProvider";
import { Ico } from "../../../src/components/primitives/Ico";
import { ReviewCard } from "../../../src/components/ReviewCard";
import {
  listReviewsForPlace,
  type PlaceReview,
} from "../../../src/lib/data-source";

// Limite relâchée : on liste tous les avis du lieu. 200 couvre largement la
// volumétrie V1 alpha sans pagination (defer Sprint 2 si un lieu explose).
const ALL_REVIEWS_LIMIT = 200;

type FetchState =
  | { kind: "loading" }
  | { kind: "loaded"; reviews: PlaceReview[] }
  | { kind: "error" };

export default function PlaceReviewsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const idRef = useRef(id);

  useEffect(() => {
    if (!id) return;
    idRef.current = id;
    let cancelled = false;
    setState({ kind: "loading" });
    void listReviewsForPlace(id, ALL_REVIEWS_LIMIT)
      .then((reviews) => {
        if (cancelled || idRef.current !== id) return;
        setState({ kind: "loaded", reviews });
      })
      .catch((err: unknown) => {
        if (cancelled || idRef.current !== id) return;
        if (__DEV__) console.warn("[PlaceReviewsScreen] fetch failed", err);
        setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      {/* Header retour + titre */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.base,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.subtle,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("place.back")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ico name="arrow-left" size={24} />
        </Pressable>
        <Text
          style={{
            ...theme.typography.preset.h2,
            color: theme.colors.text.primary,
          }}
        >
          {t("place.reviews_all_title")}
        </Text>
      </View>

      {state.kind === "loading" ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      ) : null}

      {state.kind === "error" ||
      (state.kind === "loaded" && state.reviews.length === 0) ? (
        <View style={{ padding: theme.spacing.lg }}>
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.secondary,
              fontStyle: "italic",
            }}
          >
            {t("place.reviews_empty")}
          </Text>
        </View>
      ) : null}

      {state.kind === "loaded" && state.reviews.length > 0 ? (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
          {state.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} theme={theme} />
          ))}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
