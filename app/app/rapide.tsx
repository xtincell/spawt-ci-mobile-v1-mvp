// Mode Rapide — écran swipe de suggestions (feature post-MVP #1).
//
// Derrière le flag `mode-rapide` (seed V2, OFF par défaut) : flag off →
// l'entrée hub est masquée côté feed ET tout deep link est redirigé vers le
// feed ici (défense en profondeur, même pattern que le paywall).
//
// Deck : buildRapideDeck (rankPlaces canonique) sur la MÊME source de lieux
// que le feed (listPlaces), favoris exclus, lieux verrouillés paywall exclus.
// Le deck est FIGÉ à la construction : un like en cours de session ne
// re-filtre pas les cartes restantes (sinon la pile sauterait sous le doigt).
//
// Chaque swipe nourrit : 1) les favoris (like → toggleSaved), 2) user_signals
// (swipe_like / swipe_pass, migration 0046) via track, 3) le Palais (signal
// FAIBLE via applySwipeSignal — moteur rapide-signals).

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { SwipeDeck } from "../src/components/place/SwipeDeck";
import { Ico } from "../src/components/primitives/Ico";
import { listPlaces } from "../src/lib/data-source";
import { buildRapideDeck } from "../src/lib/rapide-deck";
import type { PlaceWithScore } from "../src/lib/matching";
import { isGoldSpawter } from "../src/lib/spawter-gold";
import { track } from "../src/lib/analytics";
import { useSpawterPosition } from "../src/lib/use-spawter-position";
import { useSpawterStore } from "../src/store/spawter-store";
import { useFlag } from "../src/store/feature-flags";
import { EMPTY_PALAIS } from "../src/data/seed/sample-spawter";

export default function RapideScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  // Tous les hooks AVANT tout early return (leçon R22 — rules of hooks).
  const enabled = useFlag("mode-rapide");
  const paywallEnabled = useFlag("paywall-geo");
  const position = useSpawterPosition();

  const toggleSaved = useSpawterStore((s) => s.toggleSaved);
  const isSaved = useSpawterStore((s) => s.isSaved);
  const applySwipeSignal = useSpawterStore((s) => s.applySwipeSignal);

  const [deck, setDeck] = useState<PlaceWithScore[] | null>(null);
  // Premier swipe effectué → deck définitivement figé (un fix GPS tardif ne
  // doit pas reconstruire la pile sous le doigt du spawter).
  const startedRef = useRef(false);
  const openedTrackedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (startedRef.current) return;
    let cancelled = false;
    void (async () => {
      const places = await listPlaces();
      if (cancelled || startedRef.current) return;
      // Snapshot du store au moment du build — le deck est une photo, pas
      // une vue réactive (cf. commentaire de tête).
      const st = useSpawterStore.getState();
      const spawter = st.spawter;
      const built = buildRapideDeck(
        places,
        {
          spawter_palais: st.palais ?? EMPTY_PALAIS,
          spawter_lat: position.lat,
          spawter_lng: position.lng,
          visited_place_ids: new Set(
            st.spawts.filter((s) => s.is_verified).map((s) => s.place_id),
          ),
          saved_place_ids: st.savedPlaceIds,
          now: new Date(),
        },
        {
          enabled: paywallEnabled,
          isGold: spawter ? isGoldSpawter(spawter) : false,
          positionSource: position.source,
        },
      );
      setDeck(built);
      if (!openedTrackedRef.current) {
        openedTrackedRef.current = true;
        track({
          name: "rapide_opened",
          properties: { deck_size: built.length },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, paywallEnabled, position.lat, position.lng, position.source]);

  // Flag off → retour feed (déf. en profondeur : l'entrée est déjà masquée).
  if (!enabled) {
    return <Redirect href="/(tabs)" />;
  }

  const onLike = (item: PlaceWithScore, deckPosition: number) => {
    startedRef.current = true;
    // Le deck exclut les favoris au build, mais on re-garde l'idempotence
    // (double événement, re-entrée) : jamais de un-save par accident.
    if (!isSaved(item.place.id)) {
      void toggleSaved(item.place.id);
    }
    void applySwipeSignal(item.adn, "like");
    track({
      name: "rapide_swipe_like",
      properties: {
        place_id: item.place.id,
        match_score: item.match_score,
        deck_position: deckPosition,
      },
    });
  };

  const onPass = (item: PlaceWithScore, deckPosition: number) => {
    startedRef.current = true;
    void applySwipeSignal(item.adn, "pass");
    track({
      name: "rapide_swipe_pass",
      properties: {
        place_id: item.place.id,
        match_score: item.match_score,
        deck_position: deckPosition,
      },
    });
  };

  const onOpenPlace = (item: PlaceWithScore) => {
    router.push({
      pathname: "/place/[id]",
      params: { id: item.place.id, ref: "rapide" },
    });
  };

  const onDeckEnded = () => {
    track({
      name: "rapide_deck_ended",
      properties: { deck_size: deck?.length ?? 0 },
    });
  };

  const onBackToFeed = () => {
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.base,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <Ico name="arrow-left" size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...theme.typography.preset.h1,
              color: theme.colors.text.primary,
            }}
          >
            {t("rapide.title")}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.tertiary,
            }}
          >
            {t("rapide.subtitle")}
          </Text>
        </View>
      </View>

      {deck === null ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      ) : (
        <SwipeDeck
          deck={deck}
          onLike={onLike}
          onPass={onPass}
          onOpenPlace={onOpenPlace}
          onDeckEnded={onDeckEnded}
          onBackToFeed={onBackToFeed}
        />
      )}
    </SafeAreaView>
  );
}
