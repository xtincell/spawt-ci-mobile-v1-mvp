import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemeProvider } from "../src/theme/ThemeProvider";
import { palette } from "../src/theme/tokens";
import { useSpawterStore } from "../src/store/spawter-store";
import "../src/i18n";

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
  const hydrate = useSpawterStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
