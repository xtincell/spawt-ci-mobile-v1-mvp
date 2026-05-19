// EmptyState — état vide canonique « le chat tousse » (UX spec §1329 + §1411).
// Composant dumb : pas de logique métier, pas d'appel i18n interne — le caller
// passe les strings déjà résolues via t().

import { View, Text, Pressable } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Ico, type IconName } from "./primitives/Ico";
import { CatIcon } from "./primitives/CatIcon";

interface CTAProps {
  label: string;
  onPress: () => void;
}

export interface EmptyStateProps {
  /** Icône optionnelle (un `IconName` du set Ico). Si absent → CatIcon par défaut. */
  icon?: IconName;
  title: string;
  body: string;
  /** CTA optionnel — si absent, pas de bouton. */
  cta?: CTAProps;
}

export function EmptyState({ icon, title, body, cta }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: theme.spacing["2xl"],
        backgroundColor: theme.colors.surface.base,
      }}
    >
      <View style={{ marginBottom: theme.spacing.lg }}>
        {icon ? (
          <Ico name={icon} size={64} color={theme.colors.brand.primary} />
        ) : (
          <CatIcon size={64} color={theme.colors.brand.primary} />
        )}
      </View>
      <Text
        accessibilityRole="text"
        style={{
          ...theme.typography.preset.h2,
          color: theme.colors.text.primary,
          textAlign: "center",
          marginBottom: theme.spacing.sm,
        }}
      >
        {title}
      </Text>
      <Text
        accessibilityRole="text"
        style={{
          ...theme.typography.preset.body,
          color: theme.colors.text.secondary,
          textAlign: "center",
          maxWidth: 280,
        }}
      >
        {body}
      </Text>
      {cta ? (
        <Pressable
          onPress={cta.onPress}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          style={({ pressed }) => ({
            marginTop: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.colors.border.strong,
            opacity: pressed ? 0.7 : 1,
            minHeight: 44,
            justifyContent: "center",
          })}
        >
          <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>
            {cta.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
