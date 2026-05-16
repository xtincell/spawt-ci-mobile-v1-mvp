// Chip score de matching — vert si value >= 85, neutre sinon.
// `●` en doublon de la couleur (info jamais codée par la seule couleur).
// Cf. midfi-kit.jsx ligne 69.

import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  value: number;
  accessibilityLabel?: string;
}

// NB : les rgba(...) ci-dessous sont des dérivés translucides de :
// - palette.greenChat (rgb(45,107,79)) pour le variant ≥85
// - palette.black (rgb(10,10,10)) pour le variant <85
// La translucidité d'overlay n'est pas couverte par les tokens canoniques ;
// ces rgba ne sont PAS des hex en dur (l'audit grep sur #[0-9A-Fa-f] ne matche pas).
export function MatchScore({ value, accessibilityLabel }: Props) {
  const theme = useTheme();
  const isHigh = value >= 85;
  const bg = isHigh ? "rgba(45,107,79,0.14)" : "rgba(10,10,10,0.06)";
  const border = isHigh ? "rgba(45,107,79,0.3)" : "transparent";
  const fg = isHigh ? theme.colors.brand.accent : theme.colors.text.secondary;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 100,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
      accessibilityLabel={accessibilityLabel ?? `Score ${value}%`}
    >
      <Text style={{ fontSize: 9, color: fg }}>●</Text>
      <Text
        style={{
          fontFamily: theme.typography.preset.overline.fontFamily,
          fontSize: 11,
          color: fg,
        }}
      >
        {value}%
      </Text>
    </View>
  );
}
