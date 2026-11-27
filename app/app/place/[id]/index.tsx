import { useContentRevision } from "../../../src/lib/content-sync";
import { PlaceEditorial } from "../../../src/components/place/PlaceEditorial";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataLoadNotice } from "../../../src/components/DataLoadNotice";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { Ico, type IconName } from "../../../src/components/primitives/Ico";
import { MatchScore } from "../../../src/components/primitives/MatchScore";
import { AdnTags } from "../../../src/components/AdnTags";
import { PlaceReviews } from "../../../src/components/PlaceReviews";
import { DataSourceBanner } from "../../../src/components/DataSourceBanner";
import { getPlace, isSupabaseConfigured, type PlaceWithAdn } from "../../../src/lib/data-source";
import { buildPlaceShareUrl } from "../../../src/lib/share-links";
import {
  computeRawScore,
  displayedScore,
  haversineKm,
  toPlaceWithSignals,
} from "../../../src/lib/matching";
import { useSpawterStore } from "../../../src/store/spawter-store";
import { useFlag } from "../../../src/store/feature-flags";
import { EMPTY_PALAIS } from "../../../src/data/seed/sample-spawter";
import { track } from "../../../src/lib/analytics";
import { useSpawterPosition } from "../../../src/lib/use-spawter-position";
import { usePlaceReviewAction } from "../../../src/lib/use-place-review-action";
import { subscribeReviewChanges } from "../../../src/lib/review-events";
import { PlaceWeek } from "../../../src/components/place/PlaceWeek";
import { PlacePractical, usePlacePractical } from "../../../src/components/place/PlacePractical";
import { PlaceIdentity } from "../../../src/components/place/PlaceIdentity";
import { PlaceRecognition } from "../../../src/components/place/PlaceRecognition";
import { PlaceSectionHeader } from "../../../src/components/place/PlaceSectionHeader";
import { PlaceTravel } from "../../../src/components/place/PlaceTravel";
import leCha from "../../../src/data/le-cha-review.json";
import { PlaceNeighbors } from "../../../src/components/place/PlaceNeighbors";
import { CoupDeCoeurButton } from "../../../src/components/CoupDeCoeurButton";
import { PlaceTabs } from "../../../src/components/place/PlaceTabs";
import { PlaceMediaTab } from "../../../src/components/place/PlaceMediaTab";
import { PlaceMenuTab } from "../../../src/components/place/PlaceMenuTab";
import { OutingActions } from "../../../src/components/OutingActions";
import { useOutings } from "../../../src/store/outings-store";
import { getPlaceBudgetLabel, getPlaceBudgetTier } from "../../../src/lib/format-price";
import { estimateMenuMeal } from "../../../src/lib/menu-meal-estimate";
import { placeDishes } from "../../../src/lib/place-menu-catalog";
import { useMenuItems } from "../../../src/lib/use-menu-items";
import {
  buildStaticMapUrl,
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

type Referrer = "feed" | "search" | "map" | "share" | "direct";
const VALID_REFS: ReadonlyArray<Referrer> = [
  "feed",
  "search",
  "map",
  "share",
  "direct",
];

// R17 + R19 — onglets de la fiche, dans cet ordre produit (Média · Menu · Avis).
type PlaceTabKey = "overview" | "avis" | "menu" | "media" | "infos";
function tabFromRoute(tab?: string): PlaceTabKey {
  if (tab === "photos") return "media";
  return tab === "menu" || tab === "media" || tab === "avis" || tab === "infos" ? tab : "overview";
}

export default function PlaceDetailScreen() {
  const params = useLocalSearchParams<{ id: string; vue?: string; tab?: string }>();
  if (params.id === leCha.placeId && params.vue === "apercu") {
    // Avoid decoding the illustrated document when opening any live place.
    const Preview = require("../../../src/components/place/le-cha-demo/LeChaPreview").default;
    return <Preview tab={params.tab}/>;
  }
  return <LivePlaceDetailScreen/>;
}

function LivePlaceDetailScreen() {
  const contentRevision = useContentRevision();
  const params = useLocalSearchParams<{ id: string; ref?: string; tab?: string }>();
  useOutings();
  const id = params.id;
  const practical = usePlacePractical(id);
  const menuData = useMenuItems(id);
  const scroll = useRef<ScrollView>(null);
  const ref = (VALID_REFS as ReadonlyArray<string>).includes(params.ref ?? "")
    ? (params.ref as Referrer)
    : "direct";
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const loadedId = useRef<string | null>(null);
  const [place, setPlace] = useState<PlaceWithAdn | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [coverFailed, setCoverFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<PlaceTabKey>(() => tabFromRoute(params.tab));
  useEffect(() => { setActiveTab(tabFromRoute(params.tab)); }, [params.tab, params.id]);

  const spawter = useSpawterStore((s) => s.spawter);
  const palais = useSpawterStore((s) => s.palais ?? EMPTY_PALAIS);
  const spawts = useSpawterStore((s) => s.spawts);
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);
  const toggleSaved = useSpawterStore((s) => s.toggleSaved);

  const isSaved = id ? savedPlaceIds.has(id) : false;
  const placeViewedEmittedRef = useRef(false);
  const pilotView = useRef<{ owner: string; place: string } | null>(null);
  const adnUnderConstructionEmittedRef = useRef(false);

  useEffect(() => {
    if (!id) { setPlace(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(loadedId.current !== id);
    setFailed(false);
    if (loadedId.current !== id) setPlace(null);
    setCoverFailed(false);
    placeViewedEmittedRef.current = false;
    adnUnderConstructionEmittedRef.current = false;
    void getPlace(id).then((p) => {
      if (cancelled) return;
      loadedId.current = id;
      setPlace(p);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [id, attempt, contentRevision]);

  useEffect(() => subscribeReviewChanges(placeId => {
    if (placeId === id) setAttempt(n => n + 1);
  }), [id]);

  const visited = useMemo(
    () => new Set(spawts.filter((s) => s.is_verified).map((s) => s.place_id)),
    [spawts],
  );

  const position = useSpawterPosition();
  const { handleSpawt, startingReview } = usePlaceReviewAction(id, place?.name ?? "", position, place?.signals);

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
      toPlaceWithSignals(place),
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

  const owner = spawter?.id;
  useEffect(() => {
    if (!isSupabaseConfigured || Platform.OS !== "android" || !owner || !id || place?.id !== id) return;
    if (pilotView.current?.owner === owner && pilotView.current.place === id) return;
    pilotView.current = {owner, place: id};
    void import("../../../src/lib/pilot-journey").then(m => m.recordPilotView(owner, id)).catch(() => undefined);
  }, [owner, id, place?.id]);

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
          distance_km: position.source === "gps" && Number.isFinite(distanceKm) ? distanceKm : null,
          time_since_onboarding_seconds: timeSinceOnboardingSeconds,
        },
      });
    }
  }, [place, matchScore, ref, spawter, distanceKm, position.source]);

  // adn_under_construction_seen — si total_reviews < 5 OU confidence < 0.3
  useEffect(() => {
    if (!place || adnUnderConstructionEmittedRef.current) return;
    if (!place.adn.adn_revealed) {
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

  if (failed) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <DataLoadNotice loading={false} failed onRetry={() => setAttempt((n) => n + 1)} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={goBack} style={{ padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.text.primary }}>{t("common.back")}</Text>
      </Pressable>
    </SafeAreaView>;
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
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={goBack} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.brand.accent }}>
              ← {t("common.back")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // FR-026 : « Un lieu avec < 5 avis (avis seed INCLUS pour le calcul ADN,
  // exclus pour l'affichage du compteur communauté) affiche ADN en
  // construction ». La porte se joue donc sur `sample_size` — l'échantillon
  // réel — et NON sur `total_reviews`, qui est le compteur public.
  //
  // Le code testait `total_reviews`, ce qui annulait tout l'effet des avis
  // fondateurs : un lieu qui en a 3 aurait dû n'attendre que 2 avis de la
  // communauté pour révéler son radar ; il en fallait 5, soit 8 avis réels.
  // La condition `confidence_score >= 0.3` a également sauté : elle n'existe
  // nulle part dans le cahier et rendait la porte plus stricte que la règle
  // écrite (elle exigeait ~10 avis, pas 5).
  const adnHasEnoughReviews = place.adn.adn_revealed;
  // Le `noUncheckedIndexedAccess` typerait cover_photo_url comme `string | null`
  // mais la couche DB peut livrer `""` (Zod normalise désormais → null, voir
  // place.schema.ts). On double-check côté UI pour les seeds qui passent off-schema.
  const coverUrl = place.cover_photo_url || place.gallery_urls.find(url => /^https?:\/\//i.test(url));
  const headerImage = place.id === leCha.placeId ? require("../../../assets/editorial/le-cha-devanture.jpg") : coverUrl ? {uri:coverUrl} : undefined;
  const hasCover = Boolean(headerImage) && !coverFailed;
  // Story 4.12 — carte statique sous l'adresse. `null` si pas de clé API ou
  // coords nulles → on retombe sur l'adresse texte seule (AC #1 fallback).
  const { lat, lng, descriptive_address, city } = place.location;
  const hasPin = lat !== null && lng !== null && !(lat === 0 && lng === 0);
  const hasAddress = Boolean(descriptive_address.trim());
  const staticMapUrl = hasPin ? buildStaticMapUrl(lat, lng) : null;

  // Voix-Off "En construction" : si le Palais du spawter est trop immature
  // (confidence < 0.3), le match_score serait un mensonge UX (project-context
  // §Edge cases : "confidence_score < 0.3 → afficher En construction").
  const palaisConfident = palais.confidence_score >= 0.3;

  // Un repas par personne, hors boissons, sur la même échelle pour tous les lieux.
  const editorialTicket = place.price.avg_ticket_xof;
  const measured = typeof editorialTicket === "number" && Number.isFinite(editorialTicket) && editorialTicket >= 1;
  const estimate = measured ? null : place.price.menu_estimate_xof
    ?? estimateMenuMeal(placeDishes(place.id, menuData.items.filter(item => item.place_id === place.id)));
  const budget = {...place.price, ...(estimate != null && {menu_estimate_xof:estimate})};
  const priceLabel = getPlaceBudgetTier(budget) !== null ? getPlaceBudgetLabel(budget, t) : null;
  const area = [place.location.neighborhood, city].filter(Boolean).join(" · ");
  const overview = activeTab === "overview";

  const onCallPress = () => {
    if (!place.phone) return;
    track({ name: "place_call_tapped", properties: { place_id: place.id } });
    // Strip whitespace : `tel:+225 27 XX XX XX` casse certains dialers Android.
    const telDigits = place.phone.replace(/\s+/g, "");
    void Linking.openURL(`tel:${telDigits}`).catch(() => Alert.alert(t("place.link_failed")));
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
    void Linking.openURL(`https://wa.me/${digits}`).catch(() => Alert.alert(t("place.link_failed")));
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
    const url = buildPlaceShareUrl(place.id);
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
    }).catch(() => Alert.alert(t("saved.save_failed")));
  };

  // R17 — changement d'onglet. PlaceTabs ne déclenche `onChange` que sur un
  // VRAI changement (jamais sur re-tap de l'onglet actif) → pas de dédup ici.
  const onTabChange = (tab: PlaceTabKey) => {
    setActiveTab(tab);
    requestAnimationFrame(() => scroll.current?.scrollTo({y:0,animated:false}));
    track({
      name: "place_tab_viewed",
      properties: { place_id: place.id, tab },
    });
  };

  const onOpenMap = () => router.push({pathname:"/(tabs)/carte", params:{lieu:place.id}});

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <DataSourceBanner />

      <ScrollView ref={scroll} stickyHeaderIndices={[1]} contentContainerStyle={{paddingBottom:theme.spacing.lg}}>
        <View>
          <View testID={overview && hasCover ? "place-header-photo" : "place-header-no-gallery"} style={{minHeight:overview && hasCover ? 210 : 66}}>
            {overview && hasCover ? <Image accessible={false} source={headerImage} onError={() => setCoverFailed(true)}
              style={{width:"100%",height:210}} resizeMode="cover"/> : null}
            <View style={{position:"absolute",left:theme.spacing.base,right:theme.spacing.base,top:theme.spacing.sm,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
              <ActionIcon icon="arrow-left" label={t("place.back")} onPress={goBack}/>
              <View style={{flexDirection:"row",gap:theme.spacing.sm}}>
                <ActionIcon icon="bookmark" filled={isSaved} label={t(isSaved ? "place.heart_active":"place.heart_hint")} onPress={onToggleSavedPress}/>
                <ActionIcon icon="share" label={t("share.button_label")} onPress={onSharePress}/>
              </View>
            </View>
          </View>
          {overview ? <View style={{paddingHorizontal:theme.spacing.lg,paddingVertical:theme.spacing.sm,gap:theme.spacing.sm}}>
            <CoupDeCoeurButton place_id={place.id}/>
            <PlaceIdentity key={[place.id,place.logo_url,place.signage_url].join("/")} place={place} practical={practical.facts}
              score={place.adn.weighted_rating} reviewCount={place.adn.total_reviews} onReviews={()=>onTabChange("avis")} revision={contentRevision+"/"+attempt}/>
            {hasPin || hasAddress ? <Pressable accessibilityRole="button" testID="place-open-internal-map" onPress={onOpenMap}
              accessibilityLabel={t("place.internal_map")} style={{minHeight:44,flexDirection:"row",alignItems:"center",gap:theme.spacing.sm}}>
              <Ico name="pin" size={18} color={theme.colors.brand.accent}/>
              <Text style={{flex:1,...theme.typography.preset.body,color:theme.colors.brand.accent}}>{descriptive_address || t("place.internal_map")}</Text>
              <Ico name="chevron-right" size={16}/>
            </Pressable> : null}
            {position.source === "gps" && hasPin ? <PlaceTravel km={distanceKm}/> : null}
            <View style={{padding:theme.spacing.base,backgroundColor:theme.colors.surface.subtle,borderRadius:theme.radius.lg,gap:theme.spacing.xs}}>
              <Text style={{...theme.typography.preset.overline,color:theme.colors.brand.accent}}>{t("place.budget_title")}</Text>
              {priceLabel ? <>
                <Text accessibilityLabel={t("place.price_aria",{value:priceLabel})} style={{...theme.typography.preset.h2,color:theme.colors.text.primary}}>{priceLabel}</Text>
                <Text style={{...theme.typography.preset.caption,color:theme.colors.text.secondary}}>
                  {t(estimate != null ? "place.budget_estimated_basis" : "place.budget_basis")}
                </Text>
              </> : <Pressable testID="place-contribute-budget" accessibilityRole="button" onPress={()=>void handleSpawt()}
                style={{minHeight:44,justifyContent:"center",alignSelf:"flex-start"}}>
                <Text style={{...theme.typography.preset.small,color:theme.colors.brand.accent,textDecorationLine:"underline"}}>{t("place.budget_contribute")}</Text>
              </Pressable>}
            </View>
            {place.id === leCha.placeId ? <Pressable accessibilityRole="button" testID="open-le-cha-approved-preview"
              onPress={() => router.replace({pathname:"/place/[id]",params:{id:place.id,vue:"apercu"}})}
              style={{minHeight:44,justifyContent:"center",alignSelf:"flex-start"}}>
              <Text style={{...theme.typography.preset.body,color:theme.colors.brand.accent}}>Aperçu SPAWT →</Text>
            </Pressable> : null}
            {matchScore !== null && palaisConfident ? <MatchScore value={matchScore}/> : null}
          </View> : null}
        </View>
        <View style={{backgroundColor:theme.colors.surface.base,paddingVertical:theme.spacing.sm,paddingHorizontal:theme.spacing.sm}}>
          <PlaceTabs<PlaceTabKey> active={activeTab} onChange={onTabChange} tabs={[
            {key:"overview",label:t("place.tab_overview")},{key:"avis",label:t("place.tab_reviews")},{key:"menu",label:t("place.tab_menu")},{key:"media",label:t("place.tab_photos")},{key:"infos",label:t("place.tab_infos")}
          ]}/>
        </View>
        <View style={{paddingHorizontal:theme.spacing.base,gap:theme.spacing.base}}>
          {overview || activeTab === "avis" ? <View style={{gap:theme.spacing.sm}}>
            <PlaceSectionHeader icon="users" title={t(overview ? "place.bande_heading":"place.all_reviews_heading")} eyebrow={place.name} meta={area}/>
            <PlaceReviews key={place.id} placeId={place.id} compact={overview} limit={overview ? 3 : 5} hideTitle
              onSeeAll={() => overview ? onTabChange("avis") : router.push(`/place/${place.id}/reviews` as never)}/>
          </View> : null}
          {overview || activeTab === "menu" ? <PlaceMenuTab urls={place.menu_urls} placeId={place.id} menuData={menuData} placeName={place.name} locationLabel={area}
            {...(overview ? {onOpenMenu:()=>onTabChange("menu")} : {onBackToPlace:()=>onTabChange("overview")})}/> : null}
          {overview ? <>
            <PlaceRecognition key={place.id} placeId={place.id} name={place.name} signals={place.signals}/>
            <PlaceActivitySection placeId={place.id}/>
            <OutingActions placeId={place.id} full/>
          </> : null}
          {activeTab === "media" ? <>
            <PlaceSectionHeader icon="camera" title={t("place.tab_photos")} eyebrow={place.name} meta={area} image={headerImage}/>
            <PlaceMediaTab placeId={place.id} galleryUrls={place.gallery_urls}/>
          </> : null}
          {activeTab === "infos" ? <>
            <PlaceSectionHeader icon="map" title={t("place.practical_heading")} eyebrow={place.name} meta={area} image={headerImage}/>
            <InfoLine label={t("place.info_address")} value={descriptive_address || t("place.location_pending")} theme={theme}/>
            {hasPin || hasAddress ? <Pressable accessibilityRole="button" onPress={onOpenMap} accessibilityLabel={t("place.internal_map")} style={{gap:theme.spacing.xs,paddingVertical:theme.spacing.sm}}>
              {staticMapUrl ? <Image source={{uri:staticMapUrl}} resizeMode="cover" style={{height:140,width:"100%",borderRadius:theme.radius.md}}/> : null}
              <Text style={{...theme.typography.preset.body,color:theme.colors.brand.accent}}>{t("place.internal_map")} →</Text>
            </Pressable> : null}
            <PlaceWeek key={`week-${place.id}`} hours={place.hours} city={city}/>
            <PlacePractical facts={practical.facts}/>
            <DataLoadNotice loading={false} failed={practical.failed} onRetry={practical.retry}/>
            {place.phone ? <InfoLine label={t("place.info_phone")} value={place.phone} theme={theme} onPress={onCallPress}/> : null}
            {place.whatsapp ? <InfoLine label={t("place.info_whatsapp")} value={place.whatsapp} theme={theme} onPress={onWhatsAppPress}/> : null}
            {resaAvailable ? <InfoLine label={t("resa.button")} value="→" theme={theme} onPress={()=>setResaVisible(true)}/> : null}
            <PlaceEditorial place={place} identityVisible/>
            <View style={{gap:theme.spacing.xs}}>
              <Text accessibilityRole="header" style={{...theme.typography.preset.h2,color:theme.colors.text.primary}}>{t("place.adn_section_title")}</Text>
              {adnHasEnoughReviews ? <AdnTags adn={place.adn}/> : <Text style={{...theme.typography.preset.body,color:theme.colors.text.secondary}}>{t("place.adn_in_construction")}</Text>}
            </View>
            <PlaceNeighbors key={`nearby-${place.id}`} place={place}/>
            <Pressable testID="place-contribute" accessibilityRole="button" onPress={()=>router.push({pathname:"/contribute/[id]",params:{id:place.id,name:place.name}} as never)} style={{minHeight:44,justifyContent:"center"}}>
              <Text style={{...theme.typography.preset.body,color:theme.colors.brand.accent}}>{t("contribution.title")}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:"/support",params:{context:"place:"+place.id,topic:"question"}})} style={{minHeight:44,justifyContent:"center"}}>
              <Text style={{...theme.typography.preset.body,color:theme.colors.brand.accent}}>{t("place.question_team")}</Text>
            </Pressable>
          </> : null}
        </View>
      </ScrollView>

      {/* R11 — Sticky CTA bas « Spawt le ! » (texte produit définitif). */}
      <View
        style={{
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
          testID="place-start-review"
          disabled={startingReview}
          accessibilityState={{ disabled: startingReview, busy: startingReview }}
          accessibilityLabel={t("place.spawt_cta")}
          style={({ pressed }) => ({
            backgroundColor: theme.colors.brand.accent,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.lg,
            opacity: startingReview ? 0.5 : pressed ? 0.85 : 1,
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

function ActionIcon({icon,label,onPress,filled=false}:{icon:IconName;label:string;onPress:()=>void;filled?:boolean}) {
  const {colors,radius} = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={icon==="bookmark" ? {selected:filled} : {}} style={{width:44,height:44,justifyContent:"center",alignItems:"center",backgroundColor:colors.surface.base,borderRadius:radius.full,borderWidth:1,borderColor:colors.border.subtle}}>
    <Ico name={icon} size={20} filled={filled} color={filled?colors.brand.accent:colors.text.primary}/>
  </Pressable>;
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
