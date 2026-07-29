// Story 4.9 — Section "Ce qu'en dit la bande" sur la fiche lieu.
// Story 4.12 — AC #4 : lien « Voir tous les avis (N) » → écran dédié quand le
// total réel dépasse les 5 affichés. Le rendu d'avis est partagé via ReviewCard.
//
// Affiche jusqu'à 5 avis spawters (incl. seeds badge « Avis fondateur »).
// Fetch lazy au mount : `listReviewsForPlace(placeId, 5)` + `countReviewsForPlace`
// en parallèle. Flag `cancelled` pour éviter une race si l'utilisateur quitte la
// fiche avant le retour.
//
// Anti-patterns assumés : pas de like counter, pas de leaderboard reviewers.

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { ReviewCard } from "./ReviewCard";
import {
  countReviewsForPlace,
  listReviewsForPlace,
  type PlaceReview,
} from "../lib/data-source";

interface Props {
  placeId: string;
  /** Limit override (default 5). Test-only — la fiche utilise toujours 5. */
  limit?: number;
  /** Injection pour tests — bypass le data-source réel. */
  fetcher?: (placeId: string, limit: number) => Promise<PlaceReview[]>;
  /** Injection pour tests — compte total des avis. */
  counter?: (placeId: string) => Promise<number>;
  /** Navigation « Voir tous les avis » (fiche → route reviews). */
  onSeeAll?: () => void;
}

type FetchState =
  | { kind: "loading" }
  | { kind: "loaded"; reviews: PlaceReview[]; total: number }
  | { kind: "error" };

export function PlaceReviews({ placeId, limit = 5, fetcher, counter, onSeeAll }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  // Anti-flicker : si on remount avec un nouveau placeId, on remet loading
  // dans l'effect (pas via render) pour éviter un setState during render.
  const placeIdRef = useRef(placeId);

  useEffect(() => {
    placeIdRef.current = placeId;
    let cancelled = false;
    setState({ kind: "loading" });

    const fetchReviews = fetcher ?? listReviewsForPlace;
    const fetchCount = counter ?? countReviewsForPlace;

    void Promise.all([fetchReviews(placeId, limit), fetchCount(placeId)])
      .then(([reviews, total]) => {
        if (cancelled || placeIdRef.current !== placeId) return;
        setState({ kind: "loaded", reviews, total });
      })
      .catch((err: unknown) => {
        if (cancelled || placeIdRef.current !== placeId) return;
        if (__DEV__) console.warn("[PlaceReviews] fetch failed", err);
        setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [placeId, limit, fetcher, counter]);

  return (
    <View
      style={{
        marginTop: theme.spacing.base,
        padding: theme.spacing.base,
        backgroundColor: theme.colors.surface.raised,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      <Text
        style={{
          ...theme.typography.preset.h3,
          color: theme.colors.text.primary,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("place.reviews_title")}
      </Text>

      {state.kind === "loading" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.base,
          }}
        >
          <ActivityIndicator color={theme.colors.brand.primary} />
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.secondary,
            }}
          >
            {t("place.reviews_loading")}
          </Text>
        </View>
      ) : null}

      {state.kind === "error" || (state.kind === "loaded" && state.reviews.length === 0) ? (
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.secondary,
            fontStyle: "italic",
            paddingVertical: theme.spacing.sm,
          }}
        >
          {t("place.reviews_empty")}
        </Text>
      ) : null}

      {state.kind === "loaded" && state.reviews.length > 0 ? (
        <View style={{ gap: theme.spacing.base }}>
          {state.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} theme={theme} />
          ))}
          {/* AC #4 — bouton visible seulement si le total dépasse les avis
              affichés (count > 5). Le label porte le VRAI N. */}
          {state.total > state.reviews.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("place.reviews_see_all", {
                count: state.total,
              })}
              onPress={onSeeAll}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                paddingVertical: theme.spacing.sm,
              })}
            >
              <Text
                style={{
                  ...theme.typography.preset.body,
                  color: theme.colors.brand.accent,
                  textAlign: "center",
                }}
              >
                {t("place.reviews_see_all", { count: state.total })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
