// Story 3.4 — Fiche lieu canonique (UX spec §1127).
// Story 3.6 — toggle favori (heart top-right) + signal matching +0.05.
// Story 3.7 — bouton partager (share) + payload WhatsApp natif.
// Refonte fiche lieu (retours produit R10-R21, Q1-Q2) :
//   R10 — plus de rang de CTAs Appeler/WhatsApp proéminent (doublon InfoLines).
//   R11 — CTA sticky « Spawt le ! ».
//   R17+R19 — contenu éclaté en onglets Média · Menu · Avis (cet ordre) ;
//             ordre global : hero → titre → note+prix → signaux → onglets →
//             ADN → carte+adresse → horaires → « Divers ».
//   R18 — contact (tel/wa.me) relégué dans la section « Divers » en bas.
//   R21 — prix moyen en valeur F CFA (avg_ticket_xof), fallback échelle ₣.
// Events analytics (events.md §5) : place_viewed, place_call_tapped,
// place_whatsapp_tapped, place_tab_viewed, adn_under_construction_seen,
// place_first_view.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { Ico } from "../../../src/components/primitives/Ico";
import { Chip } from "../../../src/components/primitives/Chip";
import { Stars } from "../../../src/components/primitives/Stars";
import { MatchScore } from "../../../src/components/primitives/MatchScore";
import { AdnTags } from "../../../src/components/AdnTags";
import { PlaceReviews } from "../../../src/components/PlaceReviews";
import { DataSourceBanner } from "../../../src/components/DataSourceBanner";
import { getPlace, type PlaceWithAdn } from "../../../src/lib/data-source";
import {
  computeRawScore,
  displayedScore,
  haversineKm,
} from "../../../src/lib/matching";
import { useSpawterStore } from "../../../src/store/spawter-store";
import { useFlag } from "../../../src/store/feature-flags";
import { EMPTY_PALAIS } from "../../../src/data/seed/sample-spawter";
import { track } from "../../../src/lib/analytics";
import { useSpawterPosition } from "../../../src/lib/use-spawter-position";
import { buildManualSpawt } from "../../../src/lib/guet";
import { OpeningHours } from "../../../src/components/OpeningHours";
import { CoupDeCoeurButton } from "../../../src/components/CoupDeCoeurButton";
import { PlaceTabs } from "../../../src/components/place/PlaceTabs";
import { PlaceMediaTab } from "../../../src/components/place/PlaceMediaTab";
import { PlaceMenuTab } from "../../../src/components/place/PlaceMenuTab";
import { formatXofAmount } from "../../../src/lib/format-price";
import {
  buildStaticMapUrl,
  geoUrl,
  appleMapsUrl,
} from "../../../src/lib/static-map";
// Réservation 1-tap (0042) — bouton « Réserver » (flag reservation-1tap,
// masqué sans numéro WhatsApp), sheet groupe+créneau, trace best-effort puis
// WhatsApp pré-rempli.
import { ReservationSheet } from "../../../src/components/place/ReservationSheet";
import { createReservationRequest } from "../../../src/lib/data-source";
import { buildWaMeUrl } from "../../../src/lib/reservations";
// Événements & promos (0049/0050) — section « En ce moment », auto-gatée par
// le flag `evenements-promos` (OFF ou vide → null, fiche identique). La promo
// est un affichage ÉTIQUETÉ — jamais dans la note ni le matching (Contrat).
import { PlaceActivitySection } from "../../../src/components/place/PlaceActivitySection";

const SIGNAL_LABELS: Record<string, string> = {
  coup_de_coeur: "❤️ Coup de Cœur",
  pepite_verifiee: "💎 Pépite vérifiée",
  institution: "👑 Institution",
  fidelite: "🔁 Fidélité",
  decouverte: "🌱 Découverte",
  table_diverse: "🌍 Table diverse",
  noctambule_verifie: "🌙 Noctambule vérifié",
};

const PRICE_TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: "₣",
  2: "₣₣",
  3: "₣₣₣",
};

type Referrer = "feed" | "search" | "map" | "share" | "direct";
const VALID_REFS: ReadonlyArray<Referrer> = [
  "feed",
  "search",
  "map",
  "share",
  "direct",
];

// R17 + R19 — onglets de la fiche, dans cet ordre produit (Média · Menu · Avis).
type PlaceTabKey = "media" | "menu" | "avis";

export default function PlaceDetailScreen() {
  const params = useLocalSearchParams<{ id: string; ref?: string }>();
  const id = params.id;
  const ref = (VALID_REFS as ReadonlyArray<string>).includes(params.ref ?? "")
    ? (params.ref as Referrer)
    : "direct";
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [place, setPlace] = useState<PlaceWithAdn | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverFailed, setCoverFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<PlaceTabKey>("media");

  const registerSpawt = useSpawterStore((s) => s.registerSpawt);
  const spawter = useSpawterStore((s) => s.spawter);
  const palais = useSpawterStore((s) => s.palais ?? EMPTY_PALAIS);
  const spawts = useSpawterStore((s) => s.spawts);
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);
  const toggleSaved = useSpawterStore((s) => s.toggleSaved);

  const isSaved = id ? savedPlaceIds.has(id) : false;
  const placeViewedEmittedRef = useRef(false);
  const adnUnderConstructionEmittedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getPlace(id).then((p) => {
      if (cancelled) return;
      setPlace(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const visited = useMemo(
    () => new Set(spawts.filter((s) => s.is_verified).map((s) => s.place_id)),
    [spawts],
  );

  const position = useSpawterPosition();

  // R21 + Q4 — flag produit du prix moyen. R22 (build 8) : ce hook DOIT être
  // appelé AVANT les early returns loading/not-found ci-dessous. En build 7 il
  // vivait après → premier render (loading) sans ce hook, second render (place
  // chargée) avec → « Rendered more hooks than during the previous render » →
  // crash systématique de TOUTES les fiches lieu à l'ouverture (rules of hooks).
  const avgPriceEnabled = useFlag("place-avg-price");

  // Réservation 1-tap — hooks AVANT les early returns (même leçon R22).
  const resaEnabled = useFlag("reservation-1tap");
  const [resaVisible, setResaVisible] = useState(false);

  const matchScore = useMemo(() => {
    if (!place) return null;
    const raw = computeRawScore(
      {
        spawter_palais: palais,
        spawter_lat: position.lat,
        spawter_lng: position.lng,
        visited_place_ids: visited,
        saved_place_ids: savedPlaceIds,
        now: new Date(),
      },
      { place, adn: place.adn, last_spawt_at: null },
    );
    return displayedScore(raw);
  }, [place, palais, position, visited, savedPlaceIds]);

  const distanceKm = useMemo(() => {
    if (!place) return 0;
    return haversineKm(
      position.lat,
      position.lng,
      place.location.lat,
      place.location.lng,
    );
  }, [place, position]);

  // place_viewed — 1 émission par mount
  useEffect(() => {
    if (!place || placeViewedEmittedRef.current) return;
    placeViewedEmittedRef.current = true;
    track({
      name: "place_viewed",
      properties: {
        place_id: place.id,
        match_score: matchScore ?? 0,
        referrer: ref,
      },
    });
    if (spawter && spawter.total_spawts === 0) {
      // Time-since-onboarding réel pour la funnel Kidam — `created_at` est
      // posé à `finalizeOnboarding`. Si la valeur est manquante / invalide,
      // on remonte 0 plutôt que de fail silencieusement.
      const onboardingMs = new Date(spawter.created_at).getTime();
      const timeSinceOnboardingSeconds = Number.isFinite(onboardingMs)
        ? Math.max(0, Math.round((Date.now() - onboardingMs) / 1000))
        : 0;
      track({
        name: "place_first_view",
        properties: {
          place_id: place.id,
          match_score: matchScore ?? 0,
          distance_km: distanceKm,
          time_since_onboarding_seconds: timeSinceOnboardingSeconds,
        },
      });
    }
  }, [place, matchScore, ref, spawter, distanceKm]);

  // adn_under_construction_seen — si total_reviews < 5 OU confidence < 0.3
  useEffect(() => {
    if (!place || adnUnderConstructionEmittedRef.current) return;
    if (place.adn.total_reviews < 5 || place.adn.confidence_score < 0.3) {
      adnUnderConstructionEmittedRef.current = true;
      track({
        name: "adn_under_construction_seen",
        properties: {
          place_id: place.id,
          total_reviews: place.adn.total_reviews,
        },
      });
    }
  }, [place]);

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      >
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!place) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <Text style={{ color: theme.colors.text.secondary }}>
            {t("place.not_found")}
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.brand.accent }}>
              ← {t("common.back")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const adnHasEnoughReviews =
    place.adn.total_reviews >= 5 && place.adn.confidence_score >= 0.3;
  // Le `noUncheckedIndexedAccess` typerait cover_photo_url comme `string | null`
  // mais la couche DB peut livrer `""` (Zod normalise désormais → null, voir
  // place.schema.ts). On double-check côté UI pour les seeds qui passent off-schema.
  const coverUrl = place.cover_photo_url ?? "";
  const hasCover = coverUrl.length > 0 && !coverFailed;
  // Story 4.12 — carte statique sous l'adresse. `null` si pas de clé API ou
  // coords nulles → on retombe sur l'adresse texte seule (AC #1 fallback).
  const staticMapUrl = buildStaticMapUrl(place.location.lat, place.location.lng);

  // Voix-Off "En construction" : si le Palais du spawter est trop immature
  // (confidence < 0.3), le match_score serait un mensonge UX (project-context
  // §Edge cases : "confidence_score < 0.3 → afficher En construction").
  const palaisConfident = palais.confidence_score >= 0.3;

  // R21 + Q4 (décision produit 07/2026) — prix moyen en valeur F CFA si
  // `avg_ticket_xof` est renseigné (« ~8 000 F CFA »), sinon fallback échelle ₣
  // du tier. Convention éditoriale (méthode TheFork) : repas type par personne,
  // HORS BOISSONS — chiffre saisi par l'équipe dans le dashboard admin, aucun
  // calcul côté client. Togglable via le flag `place-avg-price` (dashboard
  // admin → Fonctionnalités) ; OFF → échelle ₣ historique. (Le hook useFlag
  // est appelé plus haut, avant les early returns — R22.)
  const avgTicket = avgPriceEnabled ? formatXofAmount(place.price.avg_ticket_xof) : null;
  const priceLabel = avgTicket
    ? t("place.price_avg", { amount: avgTicket })
    : PRICE_TIER_LABELS[place.price.tier];

  const onCallPress = () => {
    if (!place.phone) return;
    track({ name: "place_call_tapped", properties: { place_id: place.id } });
    // Strip whitespace : `tel:+225 27 XX XX XX` casse certains dialers Android.
    const telDigits = place.phone.replace(/\s+/g, "");
    void Linking.openURL(`tel:${telDigits}`);
  };

  const onWhatsAppPress = () => {
    if (!place.whatsapp) return;
    const digits = place.whatsapp.replace(/\D/g, "");
    // Sans recipient valide, `https://wa.me/` ouvre WhatsApp sur l'écran
    // d'accueil sans destinataire — comportement frustrant. On bail-out
    // silencieusement plutôt que d'envoyer l'utilisateur dans le vide.
    if (digits.length === 0) {
      if (__DEV__) console.warn("[place] whatsapp number empty after strip");
      return;
    }
    track({
      name: "place_whatsapp_tapped",
      properties: { place_id: place.id },
    });
    void Linking.openURL(`https://wa.me/${digits}`);
  };

  // Réservation 1-tap — visible si flag actif ET numéro WhatsApp exploitable.
  const resaAvailable =
    resaEnabled && (place.whatsapp ?? "").replace(/\D/g, "").length > 0;

  const onReservationConfirm = (partySize: number, slotAt: string | null) => {
    setResaVisible(false);
    const slotText = slotAt
      ? new Date(slotAt).toLocaleString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
      : t("resa.wa_slot_open");
    const message = t("resa.wa_message", {
      name: place.name,
      count: partySize,
      slot: slotText,
    });
    const url = buildWaMeUrl(place.whatsapp ?? "", message);
    if (!url) return; // garde wa.me sans destinataire (même règle qu'InfoLine)

    // Trace best-effort (0042) AVANT l'ouverture — mais jamais bloquante :
    // fire-and-forget, WhatsApp s'ouvre quoi qu'il arrive.
    if (spawter) {
      void createReservationRequest(spawter.id, {
        place_id: place.id,
        place_name: place.name,
        party_size: partySize,
        slot_at: slotAt,
        channel: "whatsapp",
      }).catch(() => {});
    }
    track({
      name: "reservation_requested",
      properties: {
        place_id: place.id,
        party_size: partySize,
        has_slot: slotAt !== null,
        channel: "whatsapp",
      },
    });
    void Linking.openURL(url);
  };

  const onSharePress = async () => {
    track({
      name: "share_initiated",
      properties: { place_id: place.id, surface: "place_detail" },
    });
    const url = `https://spawt.ci/place/${place.id}`;
    const rating = place.adn.weighted_rating;
    const message = t("share.message_template", {
      name: place.name,
      neighborhood: place.location.neighborhood,
      cuisine: place.cuisine[0] ?? "",
      // Évite « ★ 0.0 pondérée » pour les lieux non notés — fallback à dash.
      rating: rating > 0 ? rating.toFixed(1) : "—",
      score: matchScore ?? 0,
      url,
    });
    try {
      const result = await Share.share(
        { message, title: place.name, url },
        { dialogTitle: t("share.dialog_title") },
      );
      // Android ne distingue pas sharedAction de dismissedAction de manière
      // fiable (limitation react-native). On considère toute non-erreur comme
      // un succès — cohérent avec ce qu'on peut observer côté analytics.
      const succeeded =
        result.action === Share.sharedAction ||
        result.action === Share.dismissedAction;
      if (succeeded) {
        track({
          name: "share_completed",
          properties: { place_id: place.id, surface: "place_detail" },
        });
      }
    } catch (err) {
      if (__DEV__) console.warn("[share] failed", err);
      // Fallback UX : si Share natif rate (très rare), pointer l'utilisateur
      // vers une action manuelle plutôt que de laisser un silence inquiétant.
      Alert.alert(t("share.fallback_no_phone"));
    }
  };

  const onToggleSavedPress = () => {
    void toggleSaved(place.id).then((wasAdded) => {
      track({
        name: wasAdded ? "place_saved" : "place_unsaved",
        properties: { place_id: place.id },
      });
    });
  };

  // R17 — changement d'onglet. PlaceTabs ne déclenche `onChange` que sur un
  // VRAI changement (jamais sur re-tap de l'onglet actif) → pas de dédup ici.
  const onTabChange = (tab: PlaceTabKey) => {
    setActiveTab(tab);
    track({
      name: "place_tab_viewed",
      properties: { place_id: place.id, tab },
    });
  };

  // Story 4.12 — ouvre l'app cartes native. `geo:` côté Android ; iOS ne le
  // gère pas toujours → fallback Apple Maps après test canOpenURL.
  const onOpenMap = async () => {
    const { lat, lng } = place.location;
    const geo = geoUrl(lat, lng, place.name);
    try {
      const canGeo = await Linking.canOpenURL(geo);
      await Linking.openURL(canGeo ? geo : appleMapsUrl(lat, lng, place.name));
    } catch (err) {
      if (__DEV__) console.warn("[place] open map failed", err);
    }
  };

  const handleSpawt = async () => {
    if (!spawter) {
      // Pas d'onboarding fini → on ne peut pas créer de spawt. Alert plutôt
      // qu'un router.back() silencieux qui ferait croire au geste enregistré.
      Alert.alert(
        t("place.spawter_required_title"),
        t("place.spawter_required_body"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("place.spawter_required_cta"),
            onPress: () => router.replace("/"),
          },
        ],
      );
      return;
    }
    // Story 4.2 — `buildManualSpawt` factorise la construction de row mode démo
    // (UUID, timestamps, geolocation_source = "manual", is_verified = false).
    // Le badge Premier Spawt n'est pas déclenché en mode démo (is_verified false).
    const row = buildManualSpawt(
      spawter.id,
      place.id,
      place.location.lat,
      place.location.lng,
    );
    await registerSpawt(row);
    router.back();
  };

  const STICKY_HEIGHT = 64;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <DataSourceBanner />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: STICKY_HEIGHT + insets.bottom + theme.spacing.lg,
        }}
      >
        {/* Photo hero + header overlay — hauteur identique avec/sans cover
            pour éviter un saut de mise en page quand la photo rate à charger. */}
        <View style={{ position: "relative" }}>
          {hasCover ? (
            <Image
              source={{ uri: coverUrl }}
              onError={() => setCoverFailed(true)}
              style={{ width: "100%", height: 280 }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: 280,
                backgroundColor: theme.colors.surface.subtle,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ico name="pin" size={48} color={theme.colors.text.tertiary} />
            </View>
          )}
          {/* Header actions overlay */}
          <View
            style={{
              position: "absolute",
              top: theme.spacing.base,
              left: theme.spacing.base,
              right: theme.spacing.base,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t("place.back")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.surface.base,
                alignItems: "center",
                justifyContent: "center",
                ...theme.elevation.sm,
              }}
            >
              <Ico name="arrow-left" size={20} />
            </Pressable>

            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              <Pressable
                onPress={onToggleSavedPress}
                accessibilityRole="button"
                // Story 4.9 — désambiguïse vs chip Coup de Cœur sous le rating.
                // Le heart top-right = sauvegarde personnelle (favoris). Le chip
                // ❤️ sous le rating = signal communautaire rare (PRD §7.3).
                accessibilityLabel={
                  isSaved ? t("place.heart_active") : t("place.heart_hint")
                }
                accessibilityHint={t("place.heart_hint")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.colors.surface.base,
                  alignItems: "center",
                  justifyContent: "center",
                  ...theme.elevation.sm,
                }}
              >
                <Ico
                  name="heart"
                  size={20}
                  filled={isSaved}
                  color={
                    isSaved
                      ? theme.colors.brand.primary
                      : theme.colors.text.secondary
                  }
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  void onSharePress();
                }}
                accessibilityRole="button"
                accessibilityLabel={t("share.button_label")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.colors.surface.base,
                  alignItems: "center",
                  justifyContent: "center",
                  ...theme.elevation.sm,
                }}
              >
                <Ico name="share" size={20} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Titre + sous-titre */}
        <View style={{ padding: theme.spacing.lg }}>
          <Text
            style={{
              ...theme.typography.preset.display,
              color: theme.colors.text.primary,
              marginBottom: 4,
            }}
          >
            {place.name}
          </Text>
          {/* Story 4.9 — sous-titre ne porte plus le price tier (déplacé dans
              le bloc rating en h2 pour lisibilité 1m). Garde quartier + cuisine. */}
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.secondary,
              marginBottom: theme.spacing.base,
            }}
          >
            {place.location.neighborhood}
            {place.cuisine.length > 0 ? ` · ${place.cuisine.join(" · ")}` : ""}
          </Text>

          {/* Story 4.9 — Rating principal + prix en h2, visible à 1m.
              R21 — le prix affiche « ~N F CFA » si avg_ticket_xof est
              renseigné, sinon l'échelle ₣ du tier. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.base,
            }}
          >
            {place.adn.weighted_rating > 0 ? (
              <>
                <Text
                  style={{
                    ...theme.typography.preset.h2,
                    color: theme.colors.text.primary,
                  }}
                  accessibilityLabel={t("a11y.stars", {
                    count: Math.round(place.adn.weighted_rating * 10) / 10,
                    max: 5,
                  })}
                >
                  {place.adn.weighted_rating.toFixed(1)}
                </Text>
                <Stars value={place.adn.weighted_rating} size="lg" />
              </>
            ) : (
              <Chip label={t("place.notRatedYet")} variant="default" />
            )}
            <Text
              style={{
                ...theme.typography.preset.h2,
                color: theme.colors.text.primary,
                marginLeft: theme.spacing.xs,
              }}
              accessibilityLabel={t("place.price_aria", { value: priceLabel })}
            >
              {priceLabel}
            </Text>
          </View>

          {/* Q4 — convention du prix moyen affichée (honnêteté du chiffre) :
              repas type par personne, boissons non comprises. */}
          {avgTicket ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.tertiary,
                marginTop: -theme.spacing.sm,
                marginBottom: theme.spacing.base,
              }}
            >
              {t("place.price_avg_note")}
            </Text>
          ) : null}

          {/* R10 — le rang de CTAs « Appeler » / « Réserver via WhatsApp » a
              été supprimé (doublon : le téléphone réapparaissait en InfoLine).
              Le contact vit désormais dans la section « Divers » en bas (R18). */}

          {/* MatchScore + Distance (Stars + price ont été remontés au-dessus). */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: theme.spacing.sm,
              alignItems: "center",
              marginBottom: theme.spacing.base,
            }}
          >
            {matchScore !== null && palaisConfident ? (
              <MatchScore value={matchScore} />
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Ico name="walk" size={14} color={theme.colors.text.tertiary} />
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.tertiary,
                }}
              >
                {distanceKm.toFixed(1)} km
              </Text>
            </View>
          </View>

          {/* Phase 2 F12 — Coup de Cœur actionnable (quota mensuel par stade) */}
          <CoupDeCoeurButton place_id={place.id} />

          {/* Réservation 1-tap (0042) — flag reservation-1tap + WhatsApp requis. */}
          {resaAvailable ? (
            <Pressable
              onPress={() => setResaVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("resa.open_aria", { name: place.name })}
              testID="place-reserve-button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: theme.spacing.sm,
                borderWidth: 1,
                borderColor: theme.colors.brand.primary,
                borderRadius: theme.radius.lg,
                paddingVertical: theme.spacing.base,
                marginBottom: theme.spacing.base,
                minHeight: 48,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ico name="clock" size={18} color={theme.colors.brand.primary} />
              <Text
                style={{ ...theme.typography.preset.h3, color: theme.colors.brand.primary }}
              >
                {t("resa.button")}
              </Text>
            </Pressable>
          ) : null}

          {/* Signaux */}
          {place.signals.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: theme.spacing.xs,
                marginBottom: theme.spacing.lg,
              }}
            >
              {place.signals.map((s) => (
                <Chip key={s} label={SIGNAL_LABELS[s] ?? s} variant="default" />
              ))}
            </View>
          )}

          {/* « En ce moment » (0049/0050) — bandeau promo étiqueté + cartes
              événement. Rien si vide : aucun espace réservé. */}
          <PlaceActivitySection placeId={place.id} />

          {/* R17 + R19 — Onglets Média · Menu · Avis (cet ordre). Seul le
              contenu de l'onglet actif est monté : fetchs à la demande,
              fiche légère. */}
          <PlaceTabs<PlaceTabKey>
            tabs={[
              { key: "media", label: t("place.tab_media") },
              { key: "menu", label: t("place.tab_menu") },
              { key: "avis", label: t("place.tab_reviews") },
            ]}
            active={activeTab}
            onChange={onTabChange}
          />
          <View style={{ marginBottom: theme.spacing.sm }}>
            {activeTab === "media" ? (
              /* Q1 — photos de présentation (gallery_urls, jusqu'à 3) puis
                 galerie des spawters (photos des spawts du lieu). */
              <PlaceMediaTab
                placeId={place.id}
                galleryUrls={place.gallery_urls}
              />
            ) : null}
            {activeTab === "menu" ? (
              <PlaceMenuTab urls={place.menu_urls} />
            ) : null}
            {activeTab === "avis" ? (
              /* Q2 — PlaceReviews porte « Voir tous les avis (N) » → l'écran
                 dédié reviews.tsx. */
              <PlaceReviews
                placeId={place.id}
                onSeeAll={() =>
                  // `as never` : typedRoutes ne régénère pas toujours la route
                  // imbriquée hors dev-server (pattern repo, cf. profile.tsx
                  // router.push("/saved" as never)). Résout au runtime.
                  router.push(`/place/${place.id}/reviews` as never)
                }
              />
            ) : null}
          </View>

          {/* Section ADN */}
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
              {t("place.adn_section_title")}
            </Text>
            {adnHasEnoughReviews ? (
              <AdnTags adn={place.adn} />
            ) : (
              <View>
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.primary,
                    fontStyle: "italic",
                  }}
                >
                  {t("place.adn_in_construction")}
                </Text>
                <Text
                  style={{
                    ...theme.typography.preset.small,
                    color: theme.colors.text.tertiary,
                    marginTop: 4,
                  }}
                >
                  {t("place.adn_in_construction_hint", {
                    reviews: place.adn.total_reviews,
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* R19 — Carte + adresse : la carte statique descend ici, sous les
              onglets et l'ADN. Puis horaires (R12 — OpeningHours, 7 jours). */}
          <View style={{ marginTop: theme.spacing.lg }}>
            <InfoLine
              label={t("place.info_address")}
              value={place.location.descriptive_address}
              theme={theme}
            />
            {/* Story 4.12 — carte statique tappable sous l'adresse. Fallback :
                pas d'URL (clé absente / coords nulles) → rien de plus,
                l'adresse texte ci-dessus suffit (AC #1). */}
            {staticMapUrl ? (
              <Pressable
                onPress={() => {
                  void onOpenMap();
                }}
                accessibilityRole="button"
                accessibilityLabel={t("place.map_open_aria")}
                style={({ pressed }) => ({
                  marginTop: theme.spacing.sm,
                  borderRadius: theme.radius.lg,
                  overflow: "hidden",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Image
                  source={{ uri: staticMapUrl }}
                  style={{
                    width: "100%",
                    height: 140,
                    backgroundColor: theme.colors.surface.subtle,
                  }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              </Pressable>
            ) : null}
            {/* Story 4.12 — horaires des 7 jours (remplace l'ancienne ligne
                "jour courant" unique). */}
            <View style={{ marginTop: theme.spacing.sm }}>
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.secondary,
                  marginBottom: theme.spacing.xs,
                }}
              >
                {t("place.info_hours")}
              </Text>
              <OpeningHours hours={place.hours} />
            </View>
          </View>

          {/* R18 — Section « Divers » tout en bas : contact relégué en
              InfoLines simples (tel:/wa.me conservés). Intention produit :
              pousser la réservation in-app plus tard — pas de bouton
              proéminent (R10). */}
          {place.phone || place.whatsapp ? (
            <View style={{ marginTop: theme.spacing.lg }}>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {t("place.divers_title")}
              </Text>
              {place.phone ? (
                <InfoLine
                  label={t("place.info_phone")}
                  value={place.phone}
                  theme={theme}
                  onPress={onCallPress}
                />
              ) : null}
              {place.whatsapp ? (
                <InfoLine
                  label={t("place.info_whatsapp")}
                  value={place.whatsapp}
                  theme={theme}
                  onPress={onWhatsAppPress}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* R11 — Sticky CTA bas « Spawt le ! » (texte produit définitif). */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm + insets.bottom,
          backgroundColor: theme.colors.surface.base,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.subtle,
        }}
      >
        <Pressable
          onPress={() => {
            void handleSpawt();
          }}
          accessibilityRole="button"
          accessibilityLabel={t("place.spawt_cta")}
          style={({ pressed }) => ({
            backgroundColor: theme.colors.brand.accent,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.lg,
            opacity: pressed ? 0.85 : 1,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.h3,
              color: theme.colors.text.inverse,
              textTransform: "none",
            }}
          >
            {t("place.spawt_cta")}
          </Text>
        </Pressable>
      </View>

      {/* Réservation 1-tap — sheet groupe + créneau. */}
      <ReservationSheet
        visible={resaVisible}
        placeName={place.name}
        onConfirm={onReservationConfirm}
        onClose={() => setResaVisible(false)}
      />
    </SafeAreaView>
  );
}

function InfoLine({
  label,
  value,
  theme,
  onPress,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? Pressable : View;
  // Pas de cast `as (() => void) | undefined` : on omet la prop quand elle
  // n'est pas utilisée (View ignore `onPress`, mais l'omettre est plus propre
  // typage-wise et évite que les wrappers tiers la passent à des handlers).
  const onPressProps = onPress ? { onPress } : {};
  return (
    <Wrapper
      {...onPressProps}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.subtle,
      }}
    >
      <Text
        style={{
          ...theme.typography.preset.small,
          color: theme.colors.text.secondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...theme.typography.preset.small,
          color: onPress ? theme.colors.brand.accent : theme.colors.text.primary,
          flex: 1,
          textAlign: "right",
          marginLeft: 12,
        }}
      >
        {value}
      </Text>
    </Wrapper>
  );
}
