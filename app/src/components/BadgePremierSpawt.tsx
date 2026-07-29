// Story 4.2 — Modal "Premier Spawt".
// PRD §3.1 Feature 13 + cahier §5.5 — moment quasi-rituel, **pas** Duolingo
// (PRD §9.3, project-context §Voix du Chat). Pas de confettis, pas de son ding.

import { useEffect } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";

interface Props {
  visible: boolean;
  place_name?: string | undefined;
  onDismiss: () => void;
}

export function BadgePremierSpawt({ visible, place_name, onDismiss }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else {
      opacity.value = 0;
    }
  }, [visible, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: theme.colors.surface.inverse,
            alignItems: "center",
            justifyContent: "center",
            padding: theme.spacing.xl,
          },
          fadeStyle,
        ]}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: theme.colors.brand.primary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: theme.spacing.lg,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.display,
              color: theme.colors.text.onBrand,
            }}
          >
            ✦
          </Text>
        </View>

        <Text
          style={{
            ...theme.typography.preset.display,
            color: theme.colors.text.inverse,
            textAlign: "center",
            marginBottom: theme.spacing.base,
          }}
        >
          {t("badge.premier_spawt_title")}
        </Text>

        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.inverseSecondary,
            textAlign: "center",
            marginBottom: theme.spacing.xl,
          }}
        >
          {t("badge.premier_spawt_body", {
            place_name: place_name ?? "",
          })}
        </Text>

        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t("badge.premier_spawt_cta")}
          style={({ pressed }) => ({
            backgroundColor: theme.colors.brand.primary,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.full,
            opacity: pressed ? 0.85 : 1,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.h3,
              color: theme.colors.text.onBrand,
            }}
          >
            {t("badge.premier_spawt_cta")}
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
