// Story 3.3c — ModeStories : radiogroup horizontal de chips circulaires
// « JE SORS POUR… » (UX spec §1294). 5 modes V1 : traîne, découvre, tribu, chic, vite.

import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { Ico, type IconName } from "./primitives/Ico";

export type ModeKey = "traine" | "decouvre" | "tribu" | "chic" | "vite";

interface ModeSpec {
  key: ModeKey;
  icon: IconName;
}

const MODES: readonly ModeSpec[] = [
  { key: "traine", icon: "walk" },
  { key: "decouvre", icon: "compass" },
  // `tribu` = mode "groupe / amis" — distinct visuellement de `decouvre`
  // (qui partageait `compass`). `user` est l'icône la plus parlante du set
  // pour évoquer un compagnon / une tribu, sans dupliquer `compass`.
  { key: "tribu", icon: "user" },
  { key: "chic", icon: "crown" },
  { key: "vite", icon: "clock" },
];

interface Props {
  selectedMode: ModeKey | null;
  onModePress: (mode: ModeKey | null) => void;
}

export function ModeStories({ selectedMode, onModePress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View accessibilityRole="radiogroup">
      <Text
        style={{
          ...theme.typography.preset.overline,
          color: theme.colors.text.tertiary,
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("home.modes_title")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.base,
        }}
      >
        {MODES.map((m) => {
          const isSelected = selectedMode === m.key;
          const label = t(`modes.${m.key}.label`);
          return (
            <Pressable
              key={m.key}
              onPress={() => onModePress(isSelected ? null : m.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={label}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ alignItems: "center", minWidth: 60 }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.colors.surface.subtle,
                  borderWidth: isSelected ? 2.5 : 0,
                  borderColor: theme.colors.surface.inverse,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ico
                  name={m.icon}
                  size={22}
                  color={
                    isSelected
                      ? theme.colors.text.primary
                      : theme.colors.text.secondary
                  }
                />
              </View>
              <Text
                style={{
                  ...theme.typography.preset.overline,
                  color: isSelected
                    ? theme.colors.text.primary
                    : theme.colors.text.tertiary,
                  marginTop: 4,
                  textAlign: "center",
                  maxWidth: 96,
                }}
                numberOfLines={2}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
