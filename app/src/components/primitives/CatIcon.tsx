// Icône mascotte Chat — silhouette minimaliste (oreilles + tête + yeux + sourire).
// Cf. midfi-kit.jsx ligne 33.

import { View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  size?: number;
  color?: string;
  bg?: string;
}

export function CatIcon({ size = 18, color, bg = "transparent" }: Props) {
  const theme = useTheme();
  const stroke = color ?? theme.colors.text.primary;
  const inner = (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 9 L4 4 L8 7 M19 9 L20 4 L16 7"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M5 9 C5 14 8 18 12 18 C16 18 19 14 19 9"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={9.5} cy={11.5} r={0.9} fill={stroke} />
      <Circle cx={14.5} cy={11.5} r={0.9} fill={stroke} />
      <Path
        d="M11 14 L12 15 L13 14"
        stroke={stroke}
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M9 13.5 L7 14 M15 13.5 L17 14 M9.5 14.5 L7.5 15.2 M14.5 14.5 L16.5 15.2"
        stroke={stroke}
        strokeWidth={0.7}
        strokeLinecap="round"
      />
    </Svg>
  );
  if (bg === "transparent") return inner;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 9999, padding: 3 }}>{inner}</View>
  );
}
