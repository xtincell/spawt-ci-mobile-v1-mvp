// Étoiles de notation — drift D7 corrigé : max=5 par défaut (vs kit JSX max=4).

import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

export function Stars({ value, max = 5, size = 12, color, accessibilityLabel }: Props) {
  const theme = useTheme();
  const fill = color ?? theme.colors.brand.primary;
  const clamped = Math.max(0, Math.min(Math.floor(value), max));
  return (
    <View style={{ flexDirection: "row", gap: 1 }} accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: max }).map((_, i) => (
        <Text
          key={i}
          style={{
            fontSize: size,
            color: i < clamped ? fill : theme.colors.text.tertiary,
          }}
        >
          {i < clamped ? "★" : "☆"}
        </Text>
      ))}
    </View>
  );
}
