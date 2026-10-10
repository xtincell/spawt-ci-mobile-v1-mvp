// Story 4.9 / 4.12 — Carte d'avis spawter réutilisable.
//
// Extrait de PlaceReviews (Story 4.9) pour être partagé avec l'écran « Tous les
// avis » (Story 4.12 AC #4) — un seul rendu d'avis, pas de duplication.
//
// Avatar partagé : Moka si la photo est absente ou défaillante.

import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { type Theme } from "../theme/ThemeProvider";
import { SpawterAvatar } from "./SpawterAvatar";
import { Stars } from "./primitives/Stars";
import { isSupabaseConfigured, type PlaceReview } from "../lib/data-source";
import { useSpawterStore } from "../store/spawter-store";
import { ReportReviewSheet } from "./ReportReviewSheet";

const TEXTE_TRUNCATE_AT = 140;

export function ReviewCard({
  review,
  theme,
}: {
  review: PlaceReview;
  theme: Theme;
}) {
  const { t } = useTranslation();
  const spawterId = useSpawterStore((s) => s.spawter?.id ?? null);
  const [reportOpen, setReportOpen] = useState(false);
  // Signaler : uniquement en mode Supabase (la file 0026 n'existe pas en démo)
  // et jamais sur ses propres avis ni les seeds fondateurs.
  const canReport =
    isSupabaseConfigured && !review.is_seed && spawterId !== null && spawterId !== review.spawter_id;
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
      <View style={{ flex: 1, minWidth: 0 }}>
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
        <Stars value={review.note_globale ?? review.note_etoiles} size="sm" />
        {review.note_globale !== undefined ? <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("review.global_rating", { rating: review.note_globale.toFixed(1).replace(".", ",") })}</Text> : null}
        {review.note_cuisine != null && review.note_cadre != null && review.note_service != null ? <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("review.ratings_detail", { cuisine: review.note_cuisine, cadre: review.note_cadre, service: review.note_service })}</Text> : null}
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
        {review.photos.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: theme.spacing.xs,
              marginTop: theme.spacing.sm,
            }}
          >
            {review.photos.slice(0, 3).map((url, idx) => (
              <Image
                key={`${review.id}-photo-${idx}`}
                source={{ uri: url }}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surface.subtle,
                }}
                accessibilityIgnoresInvertColors
                accessibilityLabel={t("place.review_photo_alt", {
                  defaultValue: "Photo d'avis",
                })}
              />
            ))}
          </View>
        ) : null}
        {canReport ? (
          <>
            <Pressable
              accessibilityRole="button"
              testID={`report-review-${review.id}`}
              onPress={() => setReportOpen(true)}
              hitSlop={8}
              style={{ alignSelf: "flex-start", marginTop: theme.spacing.xs }}
            >
              <Text
                style={{
                  ...theme.typography.preset.caption,
                  color: theme.colors.text.secondary,
                  textDecorationLine: "underline",
                }}
              >
                {t("report.button")}
              </Text>
            </Pressable>
            <ReportReviewSheet
              visible={reportOpen}
              review_id={review.id}
              onClose={() => setReportOpen(false)}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

export function Avatar({ url }: { name: string; url: string | null; theme: Theme }) {
  return <SpawterAvatar url={url} />;
}
