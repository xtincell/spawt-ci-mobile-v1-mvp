// Wordmark SPAWT — logo-texte Klinsman 700, letter-spacing 0.02em.
// Cf. midfi-kit.jsx ligne 145.

import { Text } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

export function Wordmark({ size = 22, color, accessibilityLabel }: Props) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: theme.typography.family.brand,
        fontSize: size,
        letterSpacing: size * 0.02,
        color: color ?? theme.colors.text.primary,
      }}
      accessibilityLabel={accessibilityLabel}
    >
      SPAWT
    </Text>
  );
}
