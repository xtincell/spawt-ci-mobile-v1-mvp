// Story 3.1 — tab navigation 5 onglets canonique.
// Story 4.1 — mount <GuetIndicator /> au-dessus de la TabBar (banner sticky bas)
// quand le geofence détecte une zone active.
// Consomme la primitive <TabBar /> (Story 1.3) sans modif.
// FAB central → stub V1 (Alert) — la vraie SpawtSheet est livrée Story 4.2.

import { Alert, View } from "react-native";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
                  Alert.alert(
                    t("fab.stub_title", { defaultValue: "Je spawt ici" }),
                    t("fab.stub_body", {
                      defaultValue:
                        "Le Guet n'est pas encore armé sur ton téléphone. Va sur la fiche d'un lieu et tape « Je spawt ici (mode démo) » pour valider la mécanique.",
                    }),
                  );
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
      </Tabs>
      {/* Mount au-dessus de la TabBar — banner sticky bas, non-bloquant (pointerEvents none). */}
      <GuetIndicator place={indicatorPlace} position="bottom" />
    </View>
  );
}
