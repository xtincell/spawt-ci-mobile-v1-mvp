// Bulle de la voix du Chat — fond noir, coin asymétrique (16 16 16 4).
// Cf. midfi-kit.jsx ligne 52 + ux-design-spec § "CatBubble".
//
// CONTRAINTE CALLER : le children est une string déjà i18n via t() + chat-voice.ts
// — la primitive ne dépend pas de i18n directement (consumer-agnostic).
// La voix du Chat passe par chat-voice.ts → clé i18n, jamais littéral inline.

import type { ReactNode } from "react";
import { View } from "react-native";
import { CatIcon } from "./CatIcon";
import { useTheme } from "../../theme/ThemeProvider";

type Stage = "touriste" | "explorateur" | "detective" | "djidji" | "guide";

interface Props {
  children: ReactNode;
  variant?: "bubble" | "lockscreen" | "edito";
  // `stage` est un stub V1 — la modulation visuelle par stade n'est pas active
  // dans cette story. Préparé pour les stories Epic 5 (theme.colors.chat.<stage>).
  stage?: Stage;
}

export function CatBubble({ children, variant = "bubble", stage = "explorateur" }: Props) {
  const theme = useTheme();
  // Stub : variant et stage n'altèrent pas le rendu V1.
  void variant;
  void stage;
  return (
    <View
      accessibilityRole="text"
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
