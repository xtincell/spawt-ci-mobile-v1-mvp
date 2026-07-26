// Progression — overlay « badge débloqué » (pattern StadeCelebration, en plus
// sobre encore : pas de halo animé, pas de barre — un badge est un jalon de
// collection, pas un rituel de stade). Anti-Duolingo (PRD §9.3 Principle #5) :
// pas de confettis, pas de son. File d'attente : l'overlay montre le badge en
// tête ; « Continuer » l'acquitte et laisse la place au suivant.

import { Modal, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { gradient } from "../../theme/tokens";
import { Ico } from "../primitives/Ico";

interface Props {
  visible: boolean;
  /** Code du badge en tête de file (clés i18n dérivées `badge.<code>.*`). */
  code: string | null | undefined;
  /** Taille de la file — > 1 affiche « un autre badge t'attend ». */
  queueLength: number;
  onDismiss: () => void;
}

export function BadgeUnlocked({ visible, code, queueLength, onDismiss }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!visible || !code) return null;

  const titleKey = `badge.${code}.title`;
  const descriptionKey = `badge.${code}.description`;
  const title = t(titleKey);
  const description = t(descriptionKey);
  const remaining = Math.max(0, queueLength - 1);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <LinearGradient colors={gradient.night} style={{ position: "absolute", inset: 0 }} />

        <View
          testID="badge-unlocked-overlay"
          style={{ alignItems: "center", paddingHorizontal: theme.spacing.xl }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              borderWidth: 2,
              borderColor: theme.colors.brand.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: theme.spacing.xl,
            }}
          >
            <Ico name="paw" size={40} color={theme.colors.brand.primary} />
          </View>

          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.text.inverseSecondary,
              marginBottom: theme.spacing.sm,
            }}
          >
            {t("progression.badge_unlocked_kicker")}
          </Text>

          <Text
            style={{
              ...theme.typography.preset.display,
              color: theme.colors.brand.primary,
              textAlign: "center",
            }}
          >
            {/* t() renvoie la clé si le code est inconnu du fr.json — on rend
                alors le code brut plutôt qu'une clé technique. */}
            {title === titleKey ? code : title}
          </Text>

          {description !== descriptionKey ? (
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.inverse,
                textAlign: "center",
                marginTop: theme.spacing.base,
                fontStyle: "italic",
              }}
            >
              {description}
            </Text>
          ) : null}

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t("progression.badge_unlocked_cta_aria")}
            testID="badge-unlocked-dismiss"
            style={({ pressed }) => ({
              backgroundColor: theme.colors.brand.primary,
              paddingHorizontal: theme.spacing.xl,
              paddingVertical: theme.spacing.base,
              borderRadius: theme.radius.full,
              marginTop: theme.spacing.xl,
              opacity: pressed ? 0.85 : 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.onBrand }}>
              {t("progression.badge_unlocked_cta")}
            </Text>
          </Pressable>

          {remaining > 0 ? (
            <Text
              testID="badge-unlocked-queue-hint"
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.inverseSecondary,
                marginTop: theme.spacing.base,
              }}
            >
              {t("progression.badge_unlocked_queue", { count: remaining })}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
