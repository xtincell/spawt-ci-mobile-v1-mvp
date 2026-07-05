// Phase 2 F14 — Feuille d'upsell Spawter Gold (paywall géographique).
// Tant que le paiement CinetPay n'est pas branché, le CTA est informatif
// ("bientôt") — le paywall reste un nudge documenté, jamais une impasse.

import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { GOLD_PRICE_LABEL_TTC } from "../lib/paywall-geo";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function GoldUpsellSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay.scrim,
          justifyContent: "flex-end",
        }}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("paywall.upsell_close")}
      >
        <Pressable
          style={{
            backgroundColor: theme.colors.surface.base,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={{
              ...theme.typography.preset.h3,
              color: theme.colors.text.primary,
            }}
          >
            {t("paywall.upsell_title")}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.secondary,
            }}
          >
            {t("paywall.upsell_body", { price: GOLD_PRICE_LABEL_TTC })}
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.surface.subtle,
              borderRadius: theme.radius.md,
              padding: theme.spacing.base,
              marginTop: theme.spacing.xs,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.secondary,
                textAlign: "center",
              }}
              testID="gold-upsell-soon"
            >
              {t("paywall.upsell_soon")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={{ paddingVertical: theme.spacing.base }}
          >
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.secondary,
                textAlign: "center",
              }}
            >
              {t("paywall.upsell_close")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
