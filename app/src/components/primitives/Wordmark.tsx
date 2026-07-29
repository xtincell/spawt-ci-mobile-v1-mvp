// Wordmark SPAWT — logo-texte Klinsman 700, letter-spacing 0.02em.
// Cf. midfi-kit.jsx ligne 145.

import { Text } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  size?: number;
  color?: string;
  accessibilityLabel?: string;
  /** Opt-in : marque ce Wordmark comme un landmark heading. Réservé au header principal — éviter les H1 dupliqués. */
  asHeader?: boolean;
}

export function Wordmark({
  size = 22,
  color,
  accessibilityLabel,
  asHeader = false,
}: Props) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: theme.typography.family.brand,
        fontSize: size,
        letterSpacing: size * 0.02,
        color: color ?? theme.colors.text.primary,
      }}
      accessibilityRole={asHeader ? "header" : "text"}
      accessibilityLabel={accessibilityLabel ?? "Spawt"}
    >
      SPAWT
    </Text>
  );
}
