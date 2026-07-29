// Texture pointillée utilisée sur les fonds gr-night (Splash, célébration, paywall)
// et fonds clairs (cartes premium). Cf. spawt-tokens.css § pattern.
// NB : rgba dérivés de palette.black (default) et palette.gold (gold) — voir
// commentaire MatchScore.tsx pour la justification de la translucidité inline.

import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

interface Props {
  variant?: "default" | "gold";
  width?: number | string;
  height?: number | string;
}

export function PatternDots({ variant = "default", width = "100%", height = "100%" }: Props) {
  const fill = variant === "gold" ? "rgba(200,164,78,0.15)" : "rgba(10,10,10,0.06)";
  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id="dots" x="0" y="0" width={12} height={12} patternUnits="userSpaceOnUse">
          <Circle cx={2} cy={2} r={1} fill={fill} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#dots)" />
    </Svg>
  );
}
