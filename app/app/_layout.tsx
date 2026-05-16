import { useEffect } from "react";
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
import "../src/i18n";

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
    const inOnboarding = first === "(onboarding)";
    const onSplash = !first;

    if (spawter && (onSplash || inOnboarding)) {
      router.replace("/(tabs)");
    } else if (!spawter && inTabs) {
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
    void hydrate();
  }, [hydrate]);

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
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
