// Tab navigation racine — Feed / Profile (MVP).
// Search / Map / Spawt CTA centré seront ajoutés dans le sprint des features 10/11.

import { Tabs } from "expo-router";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface.inverse,
          borderTopColor: theme.colors.border.strong,
        },
        tabBarActiveTintColor: theme.colors.brand.primary,
        tabBarInactiveTintColor: theme.colors.text.inverseSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="profile" options={{ title: "Moi" }} />
    </Tabs>
  );
}
