// Événements & promotions (0049 + 0050) — section « En ce moment » de la
// fiche lieu. Flag `evenements-promos` : OFF → null, la fiche rend EXACTEMENT
// comme avant (non-régression). ON → bandeau(x) promo ÉTIQUETÉ(S) « PROMO »
// (pill tokens or) + carte(s) événement (titre, date FR, description).
// RIEN si vide : aucun espace réservé, pas de titre orphelin.
//
// ⚠️ Contrat SPAWT : la promo est un AFFICHAGE ÉTIQUETÉ — elle n'influence
// ni la note ni le matching. Cette section ne fait que lire et montrer.
//
// Analytics : place_event_viewed / place_promo_viewed = impression de SECTION
// (1× par mount quand la section a des données), jamais par item.

import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { useFlag } from "../../store/feature-flags";
import { track } from "../../lib/analytics";
import {
  listPlaceEvents,
  listPlacePromotions,
} from "../../lib/data-source";
import {
  formatCivilDate,
  formatEventDate,
  type PlaceEvent,
  type PlacePromotion,
} from "../../lib/place-activity";

interface Props {
  placeId: string;
  /** Injection pour tests — bypass le data-source réel. */
  eventsFetcher?: (placeId: string) => Promise<PlaceEvent[]>;
  promosFetcher?: (placeId: string) => Promise<PlacePromotion[]>;
}

type FetchState =
  | { kind: "loading" }
  | { kind: "loaded"; events: PlaceEvent[]; promos: PlacePromotion[] };

export function PlaceActivitySection({ placeId, eventsFetcher, promosFetcher }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Le hook flag est appelé INCONDITIONNELLEMENT (rules of hooks — leçon R22) ;
  // le gate se fait au rendu.
  const enabled = useFlag("evenements-promos");
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const impressionEmittedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return; // flag OFF → aucun fetch, aucune trace réseau
    let cancelled = false;
    setState({ kind: "loading" });
    const fetchEvents = eventsFetcher ?? listPlaceEvents;
    const fetchPromos = promosFetcher ?? listPlacePromotions;
    void Promise.all([fetchEvents(placeId), fetchPromos(placeId)])
      .then(([events, promos]) => {
        if (cancelled) return;
        setState({ kind: "loaded", events, promos });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (__DEV__) console.warn("[PlaceActivitySection] fetch failed", err);
        // Erreur = section absente (surface de confort, jamais un crash).
        setState({ kind: "loaded", events: [], promos: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, placeId, eventsFetcher, promosFetcher]);

  // Impressions de section — 1× par mount, seulement si la section montre
  // quelque chose (pas d'event fantôme sur section vide).
  useEffect(() => {
    if (!enabled || state.kind !== "loaded" || impressionEmittedRef.current) return;
    if (state.events.length === 0 && state.promos.length === 0) return;
    impressionEmittedRef.current = true;
    if (state.promos.length > 0) {
      track({
        name: "place_promo_viewed",
        properties: { place_id: placeId, promos_count: state.promos.length },
      });
    }
    if (state.events.length > 0) {
      track({
        name: "place_event_viewed",
        properties: { place_id: placeId, events_count: state.events.length },
      });
    }
  }, [enabled, state, placeId]);

  if (!enabled || state.kind !== "loaded") return null;
  if (state.events.length === 0 && state.promos.length === 0) return null;

  // Fenêtre civile lisible — « Du 10 juil. au 15 juil. » / « Jusqu'au 15 juil. ».
  // Closure sur `t` (le TFunction i18next typé se prête mal au passage en
  // paramètre sous exactOptionalPropertyTypes).
  const promoDatesLabel = (promo: PlacePromotion): string | null => {
    const from = promo.starts_at ? formatCivilDate(promo.starts_at) : "";
    const to = promo.ends_at ? formatCivilDate(promo.ends_at) : "";
    if (from && to) return t("place_activity.promo_dates_range", { from, to });
    if (to) return t("place_activity.promo_dates_until", { to });
    if (from) return t("place_activity.promo_dates_from", { from });
    return null;
  };

  return (
    <View style={{ marginBottom: theme.spacing.lg }} testID="place-activity-section">
      <Text
        style={{
          ...theme.typography.preset.h3,
          color: theme.colors.text.primary,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("place_activity.section_title")}
      </Text>

      {/* Bandeaux promo ÉTIQUETÉS — le pill or « PROMO » assume l'affichage
          commercial ; il ne « vend » rien d'algorithmique (Contrat SPAWT). */}
      {state.promos.map((promo) => {
        const dates = promoDatesLabel(promo);
        return (
          <View
            key={promo.id}
            testID="place-promo-banner"
            accessibilityLabel={t("place_activity.promo_aria", { label: promo.label })}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: theme.spacing.sm,
              padding: theme.spacing.base,
              marginBottom: theme.spacing.sm,
              backgroundColor: theme.colors.surface.raised,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.brand.primary,
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.brand.primary,
                borderRadius: theme.radius.full,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  ...theme.typography.preset.overline,
                  color: theme.colors.text.onBrand,
                }}
              >
                {t("place_activity.promo_tag")}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                }}
              >
                {promo.label}
              </Text>
              {dates ? (
                <Text
                  style={{
                    ...theme.typography.preset.small,
                    color: theme.colors.text.secondary,
                    marginTop: 2,
                  }}
                >
                  {dates}
                </Text>
              ) : null}
              {promo.description ? (
                <Text
                  style={{
                    ...theme.typography.preset.small,
                    color: theme.colors.text.tertiary,
                    marginTop: 2,
                  }}
                >
                  {promo.description}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}

      {/* Cartes événement — titre, date formatée FR, description. */}
      {state.events.map((event) => {
        const when = formatEventDate(event.starts_at);
        return (
          <View
            key={event.id}
            testID="place-event-card"
            accessibilityLabel={t("place_activity.event_aria", { title: event.title })}
            style={{
              padding: theme.spacing.base,
              marginBottom: theme.spacing.sm,
              backgroundColor: theme.colors.surface.raised,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border.subtle,
            }}
          >
            {when ? (
              <Text
                style={{
                  ...theme.typography.preset.overline,
                  color: theme.colors.brand.primary,
                  marginBottom: 2,
                }}
              >
                {when}
              </Text>
            ) : null}
            <Text
              style={{
                ...theme.typography.preset.h3,
                color: theme.colors.text.primary,
              }}
            >
              {event.title}
            </Text>
            {event.description ? (
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.secondary,
                  marginTop: 2,
                }}
              >
                {event.description}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

