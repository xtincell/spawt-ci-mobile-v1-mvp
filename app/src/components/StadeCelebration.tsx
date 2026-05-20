// Story 5.4 — Célébration de montée de stade (Modal plein écran).
// PRD §3.1 FR-010 + §9.3 + Experience Principle #5 — anti-Duolingo.
// Pas de confettis, pas de son ding, ton solennel quasi-rituel.

import { useEffect } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { gradient } from "../theme/tokens";
import { chatKey, type ChatMoment } from "../lib/chat-voice";
import { STADE_DESCRIPTORS, type Stade } from "../types/stade";

// PRD §9.3 — 4 montées de stade explicites (Touriste→Explorateur, etc.). Pas de moment
// `stade_up_touriste` côté CHAT_MOMENTS (un Touriste n'a pas de montée *vers* lui-même).
const STADE_UP_MOMENTS: Record<
  Exclude<Stade, "touriste">,
  Extract<ChatMoment, `stade_up_${string}`>
> = {
  explorateur: "stade_up_explorateur",
  detective: "stade_up_detective",
  djidji: "stade_up_djidji",
  guide: "stade_up_guide",
};
import { getNextStadeProgress } from "../lib/stade-progress";

interface Props {
  visible: boolean;
  from_stade?: Stade | undefined;
  to_stade?: Stade | undefined;
  unique_spots?: number | undefined;
  onDismiss: () => void;
}

const FADE_IN_MS = 400;
const HALO_PULSE_MS = 1200;

export function StadeCelebration({
  visible,
  from_stade,
  to_stade,
  unique_spots,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const opacity = useSharedValue(0);
  const haloScale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: FADE_IN_MS,
        easing: Easing.out(Easing.ease),
      });
      haloScale.value = withSequence(
        withTiming(1, { duration: HALO_PULSE_MS, easing: Easing.inOut(Easing.cubic) }),
        withDelay(
          200,
          withTiming(0.95, { duration: HALO_PULSE_MS, easing: Easing.inOut(Easing.cubic) }),
        ),
        withTiming(1, { duration: HALO_PULSE_MS, easing: Easing.inOut(Easing.cubic) }),
      );
    } else {
      opacity.value = 0;
      haloScale.value = 0.8;
    }
  }, [visible, opacity, haloScale]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ scale: haloScale.value }] }));

  if (!visible || !to_stade || !from_stade) return null;

  const fromDesc = STADE_DESCRIPTORS[from_stade];
  const toDesc = STADE_DESCRIPTORS[to_stade];

  const chatMoment: ChatMoment | null =
    to_stade === "touriste" ? null : STADE_UP_MOMENTS[to_stade];
  const chatI18nKey = chatMoment ? chatKey(chatMoment, from_stade) : "";
  const chatText = chatMoment ? t(chatI18nKey) : "";
  const chatIsSilent = !chatMoment || chatText === chatI18nKey || chatText.trim().length === 0;

  const progress = getNextStadeProgress(to_stade, unique_spots ?? 0);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <Animated.View
        style={[
          { flex: 1, alignItems: "center", justifyContent: "center" },
          fadeStyle,
        ]}
      >
        <LinearGradient
          colors={gradient.night}
          style={{ position: "absolute", inset: 0 }}
        />

        <Animated.View
          style={[
            {
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: 160,
              backgroundColor: theme.colors.brand.primary,
              opacity: 0.12,
              shadowColor: theme.colors.brand.primary,
              shadowOpacity: 0.4,
              shadowRadius: 60,
              elevation: 12,
            },
            haloStyle,
          ]}
        />

        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: theme.colors.brand.primary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: theme.spacing.xl,
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

        <View style={{ alignItems: "center", marginBottom: theme.spacing.lg }}>
          <Text
            style={{
              ...theme.typography.preset.h2,
              color: theme.colors.text.tertiary,
              textDecorationLine: "line-through",
              marginBottom: theme.spacing.xs,
            }}
            accessibilityLabel={t("celebration.from_stade_aria", { stade: fromDesc.label })}
          >
            {fromDesc.label}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.display,
              color: theme.colors.brand.primary,
            }}
            accessibilityLabel={t("celebration.to_stade_aria", { stade: toDesc.label })}
          >
            {toDesc.label}
          </Text>
        </View>

        {!chatIsSilent ? (
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.inverse,
              textAlign: "center",
              paddingHorizontal: theme.spacing.xl,
              marginBottom: theme.spacing.xl,
              fontStyle: "italic",
            }}
          >
            « {chatText} »
          </Text>
        ) : null}

        {progress.next_stade ? (
          <View style={{ width: "70%", marginBottom: theme.spacing.xl }}>
            <View
              style={{
                height: 4,
                backgroundColor: theme.colors.text.tertiary,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.round(progress.percent * 100)}%`,
                  height: "100%",
                  backgroundColor: theme.colors.brand.primary,
                }}
              />
            </View>
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: theme.colors.text.inverseSecondary,
                textAlign: "center",
                marginTop: theme.spacing.sm,
              }}
            >
              {t("celebration.progress_label", {
                current: progress.current_count,
                next_threshold: progress.next_threshold,
                next_stade: t(`stade.${progress.next_stade}`),
              })}
            </Text>
          </View>
        ) : (
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.text.inverseSecondary,
              textAlign: "center",
              marginBottom: theme.spacing.xl,
              paddingHorizontal: theme.spacing.xl,
            }}
          >
            {t("celebration.progress_label_guide")}
          </Text>
        )}

        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t("celebration.cta_aria")}
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
          <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.onBrand }}>
            {t("celebration.cta")}
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
