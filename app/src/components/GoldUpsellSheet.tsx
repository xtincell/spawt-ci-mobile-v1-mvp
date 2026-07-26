// Phase 2 F14 + Sprint 2 — Feuille d'upsell Spawter Gold (paywall géographique).
//
// CONFORMITÉ APPLE 3.1.3 (modèle Spotify/Netflix, arbitrage fondateur) :
// l'app n'affiche AUCUN prix et ne vend RIEN in-app — pas de bouton
// « acheter », pas de montant, pas de checkout. Le CTA renvoie vers le
// portail web (spawt.online) où vivent l'achat (CinetPay : Orange Money,
// Wave, MTN MoMo) et la gestion de l'abonnement. L'app se contente de LIRE
// l'entitlement (vue active_entitlements, store spawter).
//
// Deux états :
//   - non-Gold : upsell « débloque tout Abidjan » + CTA portail ;
//   - Gold actif : badge doré + lien « Gérer mon abonnement » (portail /compte).
// À l'ouverture, l'entitlement est revalidé (refreshGold) : un abonnement
// pris sur le portail apparaît sans redémarrer l'app.

import { useEffect } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { useSpawterStore } from "../store/spawter-store";
import {
  isEntitlementCurrentlyActive,
  portalAccountUrl,
  portalGoldUrl,
} from "../lib/spawter-gold";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function GoldUpsellSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const gold = useSpawterStore((s) => s.gold);
  const refreshGold = useSpawterStore((s) => s.refreshGold);
  const goldActive = isEntitlementCurrentlyActive(gold);

  // Revalidation à l'ouverture du paywall (3e déclencheur après hydratation
  // et foreground) — jamais bloquant, l'état affiché suit le store.
  useEffect(() => {
    if (visible) {
      void refreshGold();
    }
  }, [visible, refreshGold]);

  const openPortal = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Pas de navigateur dispo : silencieux, la feuille reste ouverte.
    });
  };

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
          {goldActive ? (
            <>
              {/* État Gold actif — badge doré (tokens or, jamais de hex local). */}
              <View
                testID="gold-active-badge"
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: theme.colors.brand.primary,
                  borderRadius: theme.radius.sm,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.overline,
                    color: theme.colors.text.onBrand,
                  }}
                >
                  {t("paywall.gold_badge")}
                </Text>
              </View>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                }}
              >
                {t("paywall.gold_active_title")}
              </Text>
              <Text
                style={{
                  ...theme.typography.preset.body,
                  color: theme.colors.text.secondary,
                }}
              >
                {t("paywall.gold_active_body")}
              </Text>
              <Pressable
                testID="gold-manage-cta"
                accessibilityRole="button"
                accessibilityLabel={t("paywall.gold_manage_cta")}
                onPress={() => openPortal(portalAccountUrl())}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: theme.colors.brand.primary,
                  borderRadius: theme.radius.md,
                  paddingVertical: theme.spacing.base,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.brand.primary,
                    textAlign: "center",
                  }}
                >
                  {t("paywall.gold_manage_cta")}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text
                style={{
                  ...theme.typography.preset.h3,
                  color: theme.colors.text.primary,
                }}
              >
                {t("paywall.upsell_title")}
              </Text>
              {/* Aucun prix ici — Apple 3.1.3 : la tarification vit sur le portail. */}
              <Text
                style={{
                  ...theme.typography.preset.body,
                  color: theme.colors.text.secondary,
                }}
              >
                {t("paywall.upsell_body_portal")}
              </Text>
              <Pressable
                testID="gold-upsell-cta"
                accessibilityRole="button"
                accessibilityLabel={t("paywall.upsell_cta_portal")}
                onPress={() => openPortal(portalGoldUrl())}
                style={({ pressed }) => ({
                  backgroundColor: theme.colors.brand.primary,
                  borderRadius: theme.radius.md,
                  paddingVertical: theme.spacing.base,
                  marginTop: theme.spacing.xs,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.onBrand,
                    textAlign: "center",
                  }}
                >
                  {t("paywall.upsell_cta_portal")}
                </Text>
              </Pressable>
            </>
          )}
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
