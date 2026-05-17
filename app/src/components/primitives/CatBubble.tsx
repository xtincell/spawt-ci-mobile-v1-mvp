// Bulle de la voix du Chat — fond noir, coin asymétrique (16 16 16 4).
// Cf. midfi-kit.jsx ligne 52 + ux-design-spec § "CatBubble".
//
// CONTRAINTE CALLER : le children est une string déjà i18n via t() + chat-voice.ts
// — la primitive ne dépend pas de i18n directement (consumer-agnostic).
// La voix du Chat passe par chat-voice.ts → clé i18n, jamais littéral inline.
//
// Trois variants (Story 2.1) :
// - `bubble`     : bulle de feed / profil (coin asymétrique, contexte conversationnel)
// - `lockscreen` : notification système simulée (coin uniforme, compact, max 2 lignes)
// - `edito`      : pavé baseline éditorial (UneCarousel, icône en tête)

import type { ReactNode } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";
import { CatIcon } from "./CatIcon";
import { useTheme } from "../../theme/ThemeProvider";

type Stage = "touriste" | "explorateur" | "detective" | "djidji" | "guide";
export type CatBubbleVariant = "bubble" | "lockscreen" | "edito";

interface Props {
  children: ReactNode;
  variant?: CatBubbleVariant;
  // `stage` est un stub V1 — la modulation visuelle par stade n'est pas active
  // dans cette story (décision Alexandre 2026-05-16). Préparé pour Epic 5
  // (theme.colors.chat.<stage>).
  stage?: Stage;
}

export function CatBubble({ children, variant = "bubble", stage = "explorateur" }: Props) {
  const theme = useTheme();
  void stage; // accepté en signature, réservé pour Epic 5.

  if (variant === "lockscreen") {
    const containerStyle: ViewStyle = {
      backgroundColor: theme.colors.surface.inverse,
      borderRadius: 12,
      padding: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.xs,
    };
    return (
      <View style={containerStyle}>
        <CatIcon size={14} color={theme.colors.brand.primary} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  if (variant === "edito") {
    const containerStyle: ViewStyle = {
      backgroundColor: theme.colors.surface.inverse,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.base,
      flexDirection: "column",
      gap: theme.spacing.sm,
    };
    return (
      <View style={containerStyle}>
        <CatIcon size={22} color={theme.colors.brand.primary} />
        <View>{children}</View>
      </View>
    );
  }

  // Default: bubble — rendu conversationnel, coin asymétrique
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface.inverse,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 4,
        padding: theme.spacing.base,
        flexDirection: "row",
        gap: theme.spacing.sm,
      }}
    >
      <CatIcon size={18} color={theme.colors.brand.primary} />
      <View style={{ flex: 1, paddingTop: 2 }}>{children}</View>
    </View>
  );
}
