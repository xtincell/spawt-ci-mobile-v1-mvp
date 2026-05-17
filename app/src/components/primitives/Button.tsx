// Button — 5 variants (primary / gold / gold-grad / secondary / ghost).
// Cf. ux-design-spec § "Button Hierarchy" + spawt-tokens.css.
// Cible tactile ≥ 44pt (paddingVertical 13 + label ~18 ≈ 44).
// `gold-grad` utilise expo-linear-gradient (installé Task 0 de Story 1.3).

import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

export type ButtonVariant = "primary" | "gold" | "gold-grad" | "secondary" | "ghost";

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const theme = useTheme();

  const base: StyleProp<ViewStyle> = {
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: theme.radius.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  };

  const visualFor = (
    v: ButtonVariant,
  ): { bg: string; fg: string; border?: string; useGradient?: boolean; shadow?: ViewStyle } => {
    switch (v) {
      case "gold":
        return { bg: theme.colors.brand.primary, fg: theme.colors.text.onBrand };
      case "gold-grad":
        return {
          bg: "transparent",
          fg: theme.colors.text.onBrand,
          useGradient: true,
          shadow: theme.elevation.glow as ViewStyle,
        };
      case "secondary":
        return {
          bg: "transparent",
          fg: theme.colors.text.primary,
          border: theme.colors.border.strong,
        };
      case "ghost":
        // rgba(10,10,10,0.06) : dérivé translucide de palette.black, pas couvert
        // par les tokens canoniques (cf. MatchScore.tsx pour la justification).
        return { bg: "rgba(10,10,10,0.06)", fg: theme.colors.text.primary };
      case "primary":
      default:
        return { bg: theme.colors.surface.inverse, fg: theme.colors.text.inverse };
    }
  };

  const v = visualFor(variant);
  // Label en Klinsman uppercase (preset.h3) sauf ghost qui reste discret en
  // Gotham-Bold (PostScript name explicite — RN ne synthétise pas le poids 700
  // à partir de Gotham-Book sur iOS, cf. iOS gotcha Story 1.2 Dev Notes).
  const labelStyle =
    variant === "ghost"
      ? { ...theme.typography.preset.body, fontFamily: "Gotham-Bold", color: v.fg }
      : { ...theme.typography.preset.h3, color: v.fg };

  const innerLabel = <Text style={labelStyle}>{label}</Text>;

  // `label || undefined` : un label vide ne doit pas devenir un accessibilityLabel
  // vide (sinon le screen reader annonce un bouton anonyme).
  const a11yLabel = accessibilityLabel ?? (label || undefined);
  const a11yProps = {
    accessibilityRole: "button" as const,
    accessibilityLabel: a11yLabel,
    accessibilityHint,
    accessibilityState: { disabled },
  };

  if (v.useGradient) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          { borderRadius: theme.radius.md },
          // Shadow / halo or seulement quand actif — un bouton désactivé ne
          // doit pas continuer de glow derrière son opacité 0.4.
          disabled ? null : v.shadow,
          { opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        ]}
        {...a11yProps}
      >
        <LinearGradient
          colors={theme.gradient.gold as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={base}
        >
          {innerLabel}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        base,
        {
          backgroundColor: v.bg,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
      {...a11yProps}
    >
      <View>{innerLabel}</View>
    </Pressable>
  );
}
