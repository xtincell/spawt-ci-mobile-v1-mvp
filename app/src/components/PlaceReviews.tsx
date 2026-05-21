// Story 4.9 — Section "Ce qu'en dit la bande" sur la fiche lieu.
//
// Affiche jusqu'à 5 avis spawters (incl. seeds badge « Avis fondateur »)
// avec avatar + display_name + Stars + texte tronqué à 140 chars.
//
// Fetch lazy via `listReviewsForPlace(placeId, 5)` au mount, AbortController
// pour éviter une race si l'utilisateur quitte la fiche avant le retour.
// Pas de pagination V1 — le bouton « Voir tous les avis » est non-fonctionnel
// (defer Sprint 2, screen full avis).
//
// Anti-patterns assumés (Dev Notes §5) : pas de like counter, pas de
// leaderboard reviewers, pas de placeholder image — fallback initiales sur
// cercle `brand.primary` (pattern SpawterCard Story 5.3).

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme, type Theme } from "../theme/ThemeProvider";
import { Stars } from "./primitives/Stars";
import {
  listReviewsForPlace,
  type PlaceReview,
} from "../lib/data-source";

interface Props {
  placeId: string;
  /** Limit override (default 5). Test-only — la fiche utilise toujours 5. */
  limit?: number;
  /** Injection pour tests — bypass le data-source réel. */
  fetcher?: (placeId: string, limit: number) => Promise<PlaceReview[]>;
}

const TEXTE_TRUNCATE_AT = 140;

type FetchState =
  | { kind: "loading" }
  | { kind: "loaded"; reviews: PlaceReview[] }
  | { kind: "error" };

export function PlaceReviews({ placeId, limit = 5, fetcher }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  // Anti-flicker : si on remount avec un nouveau placeId, on remet loading
  // dans l'effect (pas via render) pour éviter un setState during render.
  const placeIdRef = useRef(placeId);

  useEffect(() => {
    placeIdRef.current = placeId;
    let cancelled = false;
    // AbortController : la fonction fetcher actuelle n'accepte pas de signal
    // mais on bloque le setState post-unmount via flag — suffisant pour V1
    // (1 round-trip court). Si Supabase SDK expose signal-aware en v3, on
    // pourra propager.
    setState({ kind: "loading" });

    const fetch = fetcher ?? listReviewsForPlace;
    void fetch(placeId, limit)
      .then((reviews) => {
        if (cancelled || placeIdRef.current !== placeId) return;
        setState({ kind: "loaded", reviews });
      })
      .catch((err: unknown) => {
        if (cancelled || placeIdRef.current !== placeId) return;
        if (__DEV__) console.warn("[PlaceReviews] fetch failed", err);
        setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [placeId, limit, fetcher]);

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
          {state.reviews.length >= limit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("place.reviews_see_all", {
                count: state.reviews.length,
              })}
              // Non-fonctionnel V1 — defer Sprint 2 screen reviews full.
              onPress={undefined}
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
                {t("place.reviews_see_all", { count: state.reviews.length })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ReviewCard({
  review,
  theme,
}: {
  review: PlaceReview;
  theme: Theme;
}) {
  const { t } = useTranslation();
  const truncated =
    review.texte_avis !== null && review.texte_avis.length > TEXTE_TRUNCATE_AT
      ? `${review.texte_avis.slice(0, TEXTE_TRUNCATE_AT).trimEnd()}…`
      : review.texte_avis;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border.subtle,
      }}
    >
      <Avatar
        name={review.spawter_display_name}
        url={review.spawter_avatar_url}
        theme={theme}
      />
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: theme.spacing.xs,
            marginBottom: 2,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.primary,
              fontWeight: "600",
            }}
          >
            {review.spawter_display_name}
          </Text>
          {review.is_seed ? (
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: theme.colors.brand.primary,
              }}
              accessibilityLabel={t("place.founder_review_badge")}
            >
              {t("place.founder_review_badge")}
            </Text>
          ) : null}
        </View>
        <Stars value={review.note_etoiles} size="sm" />
        {truncated !== null ? (
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.secondary,
              marginTop: 4,
            }}
          >
            {truncated}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Avatar circulaire 32x32 — fallback initiale sur cercle `brand.primary`
 * (pattern SpawterCard Story 5.3) si `url` null. Pas de placeholder image
 * (anti-pattern §5 — éviter le pixel pixelé).
 */
function Avatar({
  name,
  url,
  theme,
}: {
  name: string;
  url: string | null;
  theme: Theme;
}) {
  if (url !== null && url.length > 0) {
    return (
      <Image
        source={{ uri: url }}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.surface.subtle,
        }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const initial = (name.charAt(0) || "S").toUpperCase();
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.brand.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          ...theme.typography.preset.body,
          color: theme.colors.text.onBrand,
          fontWeight: "700",
        }}
      >
        {initial}
      </Text>
    </View>
  );
}
