import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { HomeModeIcon } from "./HomeModeIcon";

export type ModeKey = "suggestions" | "traine" | "decouvre" | "selections";
export const HOME_MODES: readonly ModeKey[] = [
  "suggestions",
  "traine",
  "decouvre",
  "selections",
];

/** One discreet row; enlarged text can scroll horizontally instead of being clipped. */
export function ModeStories({
  selectedMode,
  onModePress,
}: {
  selectedMode: ModeKey;
  onModePress: (mode: ModeKey) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const itemWidth = Math.max(71 * Math.max(1, fontScale), (width - 36) / 4);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("home.selector_label")}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}
      >
        {HOME_MODES.map((mode) => {
          const active = selectedMode === mode;
          const title = t(`home.selector.${mode}.title`);
          const subtitle = t(`home.selector.${mode}.subtitle`);
          return (
            <Pressable
              key={mode}
              testID={`home-mode-${mode}`}
              accessibilityRole="radio"
              aria-checked={active}
              accessibilityState={{ selected: active, checked: active }}
              accessibilityLabel={`${title}, ${subtitle}`}
              onPress={() => onModePress(mode)}
              style={({ pressed }) => ({
                minWidth: itemWidth,
                paddingHorizontal: 2,
                minHeight: 44,
                alignItems: "center",
                gap: 5,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                testID={`home-mode-disc-${mode}`}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active
                    ? theme.colors.brand.primary
                    : theme.colors.surface.subtle,
                  backgroundColor: active
                    ? theme.colors.surface.inverse
                    : theme.colors.surface.subtle,
                }}
              >
                <HomeModeIcon mode={mode} active={active} />
              </View>
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.primary,
                  textAlign: "center",
                }}
              >
                {mode === "suggestions" ? t("home.suggestions_short") : title}
              </Text>
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.secondary,
                  textAlign: "center",
                  maxWidth: itemWidth,
                }}
              >
                {subtitle}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
