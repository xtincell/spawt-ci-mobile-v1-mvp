import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { palette } from "../src/theme/tokens";
import { useAppFonts } from "../src/theme/useAppFonts";
import { useSpawterStore } from "../src/store/spawter-store";
import { flushPendingSignals } from "../src/lib/analytics";
import { isSupabaseConfigured } from "../src/lib/data-source";
// CR finding M1 — import dynamique gated __DEV__ pour que le module + ses
// credentials env vars NE soient PAS bundlés en prod. Le gate runtime interne
// à maybeDevAutologin ne suffit pas : le `import` statique embarque le code
// dans le bundle JS livré au spawter.
// Story 4.1 — import side-effect : enregistre `TaskManager.defineTask` au
// niveau module (invariant OS-kill Tecno/Infinix). Doit être importé une
// seule fois au Root, avant tout mount des écrans.
import "../src/lib/guet";
import {
  ensureGuetChannel,
  setupGuetCategories,
  bootGuet,
  shutdownGuet,
} from "../src/lib/guet";
import { AppOpening } from "../src/components/brand/AppOpening";
import { BadgePremierSpawt } from "../src/components/BadgePremierSpawt";
import { StadeCelebration } from "../src/components/StadeCelebration";
import {
  bootOfflineQueue,
  shutdownOfflineQueue,
} from "../src/lib/offline-queue-init";
// Feature 13 — push serveur : enregistrement du token Expo + routage des taps
// (deep link `data.deep_link`). Listener séparé de celui du Guet.
import {
  registerPushToken,
  registerPushResponseHandler,
} from "../src/lib/push-token";
import { initMonitoring } from "../src/lib/monitoring";
import "../src/i18n";

// Câblage MVP — crash reporting le plus tôt possible (no-op sans DSN).
initMonitoring();

// Garder le splash natif Expo jusqu'à ce que useAppFonts ait fini (loaded || error).
// `.catch(() => {})` neutralise l'erreur "already hidden" en Fast Refresh.
void SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op */
});

function RouteGuard() {
  const router = useRouter();
  const segments = useSegments();
  const hydrating = useSpawterStore((s) => s.hydrating);
  const spawter = useSpawterStore((s) => s.spawter);

  useEffect(() => {
    if (hydrating) return;
    const first = segments[0] as string | undefined;
    const inTabs = first === "(tabs)";
    // Les écrans modaux au root (search, saved) sont accessibles uniquement
    // pour un spawter onboardé — sinon on rebascule vers le splash, sinon
    // un utilisateur deep-linké atteindrait un écran qui dépend du store.
    // Sprint 2 — rapide/explore : mêmes règles (dépendent du store ; leur
    // gate de flag interne redirige ensuite vers le feed si flag off).
    const inGuardedRoot =
      first === "search" ||
      first === "saved" ||
      first === "settings" ||
      first === "rapide" ||
      first === "explore" ||
      // Mode Crew — l'écran de session dépend du spawter (identité + votes).
      first === "crew";
    const inOnboarding = first === "(onboarding)";
    const onSplash = !first;

    if (spawter && (onSplash || inOnboarding)) {
      router.replace("/(tabs)");
    } else if (!spawter && (inTabs || inGuardedRoot)) {
      router.replace("/");
    }
  }, [hydrating, spawter, segments, router]);

  return null;
}

export default function RootLayout() {
  // Tous les hooks doivent rester au-dessus du early-return `null` (rules of
  // hooks) — ne pas insérer d'effet side-effect ici sans déplacer le guard.
  const hydrate = useSpawterStore((s) => s.hydrate);
  const { fontsLoaded, fontError } = useAppFonts();

  useEffect(() => {
    void (async () => {
      // CR finding M1 — gate __DEV__ AVANT l'import dynamique : le bundler
      // Metro tree-shake l'import si la condition est statiquement falsy en prod.
      if (__DEV__) {
        const { maybeDevAutologin } = await import("../src/lib/dev-autologin");
        await maybeDevAutologin();
      }
      await hydrate();
    })();
  }, [hydrate]);

  // Story 4.1 + 4.2 — channel Android + catégories d'actions notif (Confirmer/Snooze).
  // Idempotent — pose les fondations pour scheduleGuetPrompt côté guet-task.
  useEffect(() => {
    void ensureGuetChannel();
    void setupGuetCategories();
  }, []);

  // Câblage MVP — orchestrateur du Guet : dès qu'un spawter onboardé existe,
  // boucle complète armement → geofence → notif 15min → confirm/passive.
  // Au logout (spawter → null post-hydratation), tout est désarmé.
  const spawterId = useSpawterStore((s) => s.spawter?.id ?? null);
  const storeHydrating = useSpawterStore((s) => s.hydrating);
  useEffect(() => {
    if (storeHydrating) return;
    if (spawterId) {
      // Feature 13 — registerPushToken APRÈS bootGuet (séquencé, pas en
      // parallèle) : les deux passent par le même helper de permission
      // notifications, l'ordre garantit un seul dialogue système. Couvre le
      // login réussi ET le boot avec session (spawterId passe non-null dans
      // les deux cas). Jamais avant le consentement : un spawter n'existe
      // qu'après l'écran consent bloquant de l'onboarding.
      void (async () => {
        await bootGuet();
        await registerPushToken();
      })();
    } else {
      void shutdownGuet();
    }
  }, [spawterId, storeHydrating]);

  // Feature 13 — tap d'une notification push serveur → deep link. Monté 1× au
  // Root (indépendant du Guet : fonctionne même Guet opt-out ou non booté).
  useEffect(() => {
    const unsubscribe = registerPushResponseHandler();
    return unsubscribe;
  }, []);

  // Story 4.3 — branche NetInfo → flush des mutations spawt_checkin queue offline.
  // No-op en mode démo (pas de Supabase) et tolérant à l'absence de NetInfo (web).
  useEffect(() => {
    void bootOfflineQueue();
    return () => {
      shutdownOfflineQueue();
    };
  }, []);

  // Story 4.2 — Premier Spawt : overlay rendu si pendingBadge non-null.
  const pendingBadge = useSpawterStore((s) => s.pendingBadge);
  const consumePendingBadge = useSpawterStore((s) => s.consumePendingBadge);

  // Story 5.4 — Célébration de stade : overlay rendu si pendingStadeCelebration non-null.
  const pendingStadeCelebration = useSpawterStore((s) => s.pendingStadeCelebration);
  const consumePendingStadeCelebration = useSpawterStore(
    (s) => s.consumePendingStadeCelebration,
  );

  // CR finding M9 — gate les overlays sur !hydrating pour empêcher leur mount
  // pré-hydrate (sinon unlockTitle dans consumePendingBadge serait no-op à cause
  // de `spawter === null` et le badge serait perdu à jamais).
  const hydrating = useSpawterStore((s) => s.hydrating);

  // R23 (build 8) — ouverture animée à CHAQUE lancement (logo → Moka, ~2 s,
  // skippable au tap). Overlay au-dessus du Stack : l'app hydrate derrière,
  // jamais bloquante. Le splash NATIF Expo (statique) est masqué dès que les
  // fonts sont prêtes → l'overlay prend le relais sans trou blanc.
  const [openingVisible, setOpeningVisible] = useState(true);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch((err: unknown) => {
        if (__DEV__) console.warn("[splash] hideAsync failed", err);
      });
    }
  }, [fontsLoaded, fontError]);

  // Flush la queue analytics AsyncStorage à chaque SIGNED_IN (Story 1.7 D2 +
  // câblage attendu par Story 2.3 OTP). En mode démo (pas d'env Supabase),
  // on skip — pas de session auth donc rien à drainer côté DB.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      // Import dynamique — cohérent avec la règle d'or data-source.
      const { supabase } = await import("../src/lib/supabase");
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") void flushPendingSignals();
      });
      unsub = () => data.subscription.unsubscribe();
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Tant que les polices ne sont ni chargées ni en erreur, garder le splash natif.
  // Sur web, expo-splash-screen est no-op et expo-font charge via CSS @font-face
  // (asynchrone, sans signal fiable côté useFonts) — gate désactivé pour éviter
  // un null persistant qui rend l'app blanche dans le navigateur.
  if (Platform.OS !== "web" && !fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style="light" backgroundColor={palette.black} />
          <RouteGuard />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.black },
              animation: "fade",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="place/[id]" options={{ presentation: "card" }} />
            <Stack.Screen
              name="place/[id]/reviews"
              options={{ presentation: "card" }}
            />
            <Stack.Screen name="search" options={{ presentation: "modal" }} />
            <Stack.Screen name="saved" options={{ presentation: "card" }} />
            {/* Sprint 2 — modes plein écran (flags mode-rapide / mode-explore). */}
            <Stack.Screen name="rapide" options={{ presentation: "card" }} />
            <Stack.Screen name="explore" options={{ presentation: "card" }} />
            <Stack.Screen
              name="explore/[slug]"
              options={{ presentation: "card" }}
            />
            <Stack.Screen name="settings" options={{ presentation: "card" }} />
            {/* Mode Crew — écran de session (flag mode-crew, entrée via l'onglet Meute). */}
            <Stack.Screen name="crew/[id]" options={{ presentation: "card" }} />
            <Stack.Screen
              name="review/[spawt_id]"
              options={{ presentation: "modal" }}
            />
          </Stack>
          <BadgePremierSpawt
            visible={!hydrating && pendingBadge !== null}
            place_name={pendingBadge?.place_name}
            onDismiss={() => {
              void consumePendingBadge();
            }}
          />
          <StadeCelebration
            visible={!hydrating && pendingStadeCelebration !== null}
            from_stade={pendingStadeCelebration?.from_stade}
            to_stade={pendingStadeCelebration?.to_stade}
            unique_spots={pendingStadeCelebration?.unique_spots}
            onDismiss={() => {
              void consumePendingStadeCelebration();
            }}
          />
          {/* R23 — l'ouverture animée est le DERNIER enfant : elle recouvre
              tout (Stack + overlays) jusqu'à sa fin ou un tap. */}
          {openingVisible ? (
            <AppOpening onFinished={() => setOpeningVisible(false)} />
          ) : null}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
