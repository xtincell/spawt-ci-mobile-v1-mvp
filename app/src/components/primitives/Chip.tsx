// Chip — 5 variants canoniques (chip / chip-gold / chip-green / chip-dark / chip-outline).
// Cf. ux-design-spec § "chips" + spawt-tokens.css.
// Si `onPress` fourni → Pressable interactif, sinon View statique.

import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

export type ChipVariant = "default" | "gold" | "green" | "dark" | "outline";

interface Props {
  label: string;
  variant?: ChipVariant;
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
}

export function Chip({
  label,
  variant = "default",
  onPress,
  selected = false,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();

  const palette = (() => {
    switch (variant) {
      case "gold":
        return {
          bg: theme.colors.brand.primary,
          fg: theme.colors.text.onBrand,
          border: "transparent",
        };
      case "green":
        return {
          bg: theme.colors.brand.accent,
          fg: theme.colors.text.inverse,
          border: "transparent",
        };
      case "dark":
        return {
          bg: theme.colors.surface.inverse,
          fg: theme.colors.text.inverse,
          border: selected ? theme.colors.brand.primary : "transparent",
        };
      case "outline":
        return {
          bg: "transparent",
          fg: theme.colors.text.primary,
          border: theme.colors.border.strong,
        };
      case "default":
      default:
        return {
          bg: theme.colors.surface.subtle,
          fg: theme.colors.text.primary,
          border: "transparent",
        };
    }
  })();

  const content = (
    <View
      style={{
        backgroundColor: palette.bg,
        borderRadius: theme.radius.full,
        borderWidth: variant === "outline" ? 1 : selected && variant === "dark" ? 2.5 : 0,
        borderColor: palette.border,
        paddingHorizontal: theme.spacing.base,
        paddingVertical: theme.spacing.sm,
        minHeight: 32,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ ...theme.typography.preset.small, color: palette.fg }}>{label}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected ? { selected: true } : undefined}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      {content}
    </Pressable>
  );
}
