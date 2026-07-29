// Refonte fiche lieu (R17 + R19) — segmented control léger et réutilisable.
// Éclate le contenu de la fiche en onglets (Média · Menu · Avis sur la fiche
// lieu). Pur RN + tokens, aucune dépendance nouvelle.
//
// Composant dumb : pas d'analytics interne — le caller émet `place_tab_viewed`
// dans son `onChange` (qui n'est déclenché QUE sur un vrai changement, jamais
// sur un re-tap de l'onglet actif).

import { Pressable, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";

export interface PlaceTabItem<K extends string = string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  tabs: ReadonlyArray<PlaceTabItem<K>>;
  active: K;
  onChange: (key: K) => void;
}

export function PlaceTabs<K extends string>({ tabs, active, onChange }: Props<K>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: theme.colors.surface.subtle,
        borderRadius: theme.radius.full,
        padding: theme.spacing.xs,
        gap: theme.spacing.xs,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (!isActive) onChange(tab.key);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.full,
              backgroundColor: isActive
                ? theme.colors.surface.base
                : "transparent",
              ...(isActive ? theme.elevation.sm : null),
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.small,
                color: isActive
                  ? theme.colors.text.primary
                  : theme.colors.text.secondary,
                fontWeight: isActive ? "700" : "400",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
