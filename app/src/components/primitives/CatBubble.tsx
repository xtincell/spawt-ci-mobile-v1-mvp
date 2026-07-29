// Bulle de la voix du Chat — fond noir, coin asymétrique (16 16 16 4).
// Cf. ux-design-spec § "CatBubble" + composant CatBubble.jsx du DS CANON.
//
// MAJ design system 07/2026 : la tête du Chat est désormais la POSE MOKA EN
// PNG dans un cercle or (CatMarkBadge) — le chat vectoriel (CatIcon) est
// retiré, règle stricte du DS. La pose est paramétrable par le caller
// (`pose`), défaut « salut ».
//
// CONTRAINTE CALLER : le children est une string déjà i18n via t() + chat-voice.ts
// — la primitive ne dépend pas de i18n directement (consumer-agnostic).
//
// Trois variants (Story 2.1) :
// - `bubble`     : bulle de feed / profil (coin asymétrique, contexte conversationnel)
// - `lockscreen` : notification système simulée (coin uniforme, compact, max 2 lignes)
// - `edito`      : pavé baseline éditorial (UneCarousel, tête en exergue)

import type { ReactNode } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";
import { CatMarkBadge, type MokaPose } from "../brand/CatMark";
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
  /** Pose Moka de l'avatar (une pose par scénario — défaut « salut »). */
  pose?: MokaPose;
}

export function CatBubble({
  children,
  variant = "bubble",
  stage = "explorateur",
  pose = "salut",
}: Props) {
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
        <CatMarkBadge pose={pose} size={20} />
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
        <CatMarkBadge pose={pose} size={34} />
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
      <CatMarkBadge pose={pose} size={28} />
      <View style={{ flex: 1, paddingTop: 2 }}>{children}</View>
    </View>
  );
}
