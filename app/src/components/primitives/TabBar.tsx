// TabBar 5 onglets — Feed · Carte · [FAB +] · Meute · Palais.
// Cf. midfi-kit.jsx ligne 120 + ux-design-spec § "Navigation patterns".
// Hauteur 78pt + safe-area home indicator (paddingBottom: insets.bottom).
// FAB central 48px débord -22, bg noir, Ico plus or, elevation md.

import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ico, type IconName } from "./Ico";
import { useTheme } from "../../theme/ThemeProvider";

type TabId = "home" | "map" | "fab" | "tribu" | "profile";
type ActiveId = Exclude<TabId, "fab">;

interface Props {
  active: ActiveId;
  onTabPress: (id: TabId) => void;
}

interface TabSpec {
  id: TabId;
  labelKey: "feed" | "map" | "fab" | "meute" | "palais";
  icon: IconName;
}

const TABS: readonly TabSpec[] = [
  { id: "home", labelKey: "feed", icon: "home" },
  { id: "map", labelKey: "map", icon: "map" },
  { id: "fab", labelKey: "fab", icon: "plus" },
  { id: "tribu", labelKey: "meute", icon: "compass" },
  { id: "profile", labelKey: "palais", icon: "user" },
];

export function TabBar({ active, onTabPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        height: 78 + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.surface.base,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border.subtle,
      }}
    >
      {TABS.map((tab) => {
        const label = t(`nav.${tab.labelKey}`);
        if (tab.id === "fab") {
          return (
            <Pressable
              key={tab.id}
              onPress={() => onTabPress("fab")}
              accessibilityRole="button"
              accessibilityLabel={label}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.colors.surface.inverse,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -22,
                  ...theme.elevation.md,
                }}
              >
                <Ico name="plus" size={22} color={theme.colors.brand.primary} />
              </View>
            </Pressable>
          );
        }
        const isActive = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabPress(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            hitSlop={{ top: 8, bottom: 8 }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              minHeight: 44,
            }}
          >
            <Ico
              name={tab.icon}
              size={22}
              filled={isActive}
              color={isActive ? theme.colors.text.primary : theme.colors.text.tertiary}
            />
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: isActive ? theme.colors.text.primary : theme.colors.text.tertiary,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
