import { useEffect, useRef } from "react";
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

export type ModeKey = "suggestions" | "rapide" | "selections" | "duo" | "spots";
export const HOME_MODES: readonly ModeKey[] = [
  "suggestions",
  "rapide",
  "selections",
  "duo",
  "spots",
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
  const inset = width < 360 ? theme.spacing.sm : theme.spacing.base;
  const minWidth = fontScale > 1 ? 72 * fontScale : 58;
  const itemWidth = Math.max(minWidth, (width - 2 * inset) / HOME_MODES.length);
  const row = useRef<ScrollView>(null);
  useEffect(() => {
    const index = HOME_MODES.indexOf(selectedMode);
    row.current?.scrollTo({
      x: Math.max(0, inset + index * itemWidth - (width - itemWidth) / 2),
      animated: false,
    });
  }, [selectedMode, itemWidth, width, inset]);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("home.selector_label")}
    >
      <ScrollView
        ref={row}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: inset, alignItems: "stretch" }}
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
              onPress={() => {
                if (!active) onModePress(mode);
              }}
              style={({ pressed }) => ({
                width: itemWidth,
                minHeight: 44,
                alignItems: "center",
                gap: theme.spacing.sm,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                testID={`home-mode-disc-${mode}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radius.full,
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
              <View style={{ alignSelf: "stretch", alignItems: "center", gap: 2 }}>
                <Text
                  style={{
                    ...theme.typography.preset.caption,
                    textTransform: "none",
                    letterSpacing: 0,
                    fontFamily: theme.typography.preset.overline.fontFamily,
                    color: active ? theme.colors.brand.accent : theme.colors.text.primary,
                    textAlign: "center",
                  }}
                >
                  {title}
                </Text>
                <Text
                  style={{
                    ...theme.typography.preset.caption,
                    textTransform: "none",
                    letterSpacing: 0,
                    fontFamily: theme.typography.family.body,
                    color: theme.colors.text.secondary,
                    textAlign: "center",
                    maxWidth: itemWidth,
                  }}
                >
                  {subtitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
