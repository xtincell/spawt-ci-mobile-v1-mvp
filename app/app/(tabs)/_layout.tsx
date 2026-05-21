// Story 3.1 — tab navigation 5 onglets canonique.
// Story 4.1 — mount <GuetIndicator /> au-dessus de la TabBar (banner sticky bas)
// quand le geofence détecte une zone active.
// Story 4.10 — FAB central navigue vers `(tabs)/spawter` (route masquée du
// TabBar via `href: null`). Remplace le stub Alert livré Story 3.1.
// Consomme la primitive <TabBar /> (Story 1.3) sans modif.

import { View } from "react-native";
import { Tabs } from "expo-router";
import { TabBar } from "../../src/components/primitives/TabBar";
import { GuetIndicator } from "../../src/components/GuetIndicator";
import { useGuetActiveZone } from "../../src/store/guet-active";

type TabId = "home" | "map" | "fab" | "tribu" | "profile";
type ActiveId = Exclude<TabId, "fab">;

// Map route Expo Router → id TabBar (cohérent UX spec §1442).
// Route "profile" garde son nom V1 — label affiché « Palais » via i18n
// (cf. Story 3.1 Dev Notes §3 — renommage déféré Story 5.3).
function mapRouteToActive(routeName: string): ActiveId {
  switch (routeName) {
    case "index":
      return "home";
    case "carte":
      return "map";
    case "meute":
      return "tribu";
    case "profile":
      return "profile";
    default:
      return "home";
  }
}

function mapTabIdToRoute(id: ActiveId): "index" | "carte" | "meute" | "profile" {
  switch (id) {
    case "home":
      return "index";
    case "map":
      return "carte";
    case "tribu":
      return "meute";
    case "profile":
      return "profile";
  }
}

export default function TabsLayout() {
  const guetZone = useGuetActiveZone();
  const indicatorPlace = guetZone
    ? { id: guetZone.place_id, name: guetZone.place_name }
    : null;
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => {
          const route = props.state.routes[props.state.index];
          const active = mapRouteToActive(route?.name ?? "index");
          return (
            <TabBar
              active={active}
              onTabPress={(id) => {
                if (id === "fab") {
                  // Story 4.10 — navigation vers l'écran modal Spawter géoloc
                  // (route masquée du TabBar, accessible via FAB uniquement).
                  props.navigation.navigate("spawter");
                  return;
                }
                props.navigation.navigate(mapTabIdToRoute(id));
              }}
            />
          );
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="carte" />
        <Tabs.Screen name="meute" />
        <Tabs.Screen name="profile" />
        {/* Story 4.10 — onglet caché : navigué uniquement via le FAB central.
            `href: null` retire la route du TabBar visible mais la garde
            navigable programmatiquement (expo-router). */}
        <Tabs.Screen name="spawter" options={{ href: null }} />
      </Tabs>
      {/* Mount au-dessus de la TabBar — banner sticky bas, non-bloquant (pointerEvents none). */}
      <GuetIndicator place={indicatorPlace} position="bottom" />
    </View>
  );
}
