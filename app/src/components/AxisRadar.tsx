// Radar à 5 axes — utilisé pour le Palais (spawter) ET l'ADN (lieu).
// Rendu SVG pur pour ne pas dépendre de Mapbox/Victory.

import Svg, { Polygon, Polyline, Line, Text as SvgText, Circle } from "react-native-svg";
import { View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface AxisData {
  /** Score normalisé [-1, 1] */
  value: number;
  /** Label pôle négatif (à gauche) */
  negLabel: string;
  /** Label pôle positif (à droite) */
  posLabel: string;
}

interface Props {
  axes: [AxisData, AxisData, AxisData, AxisData, AxisData];
  size?: number;
  /** Couleur du polygone rempli */
  color?: string;
  /** Si true, affiche un radar "en construction" (gris pâle) */
  underConstruction?: boolean;
}

export function AxisRadar({ axes, size = 240, color, underConstruction = false }: Props) {
  const theme = useTheme();
  const stroke = underConstruction ? theme.colors.border.subtle : (color ?? theme.colors.brand.primary);
  const fill = underConstruction ? "transparent" : `${color ?? theme.colors.brand.primary}33`;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const labelRadius = radius + 18;

  // 5 axes répartis à 72° d'écart, départ en haut
  const angles = axes.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);

  // Convertit valeur [-1, 1] vers point cartésien (le centre = 0, bord = ±1)
  const points = axes
    .map((axis, i) => {
      const angle = angles[i] ?? 0;
      // Map [-1, 1] → [0, 1] : 0 = pôle négatif (centre du radar côté opposé), 1 = pôle positif
      const r = ((axis.value + 1) / 2) * radius;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    })
    .join(" ");

  // Cercles concentriques (graduations)
  const grid = [0.25, 0.5, 0.75, 1].map((t) => t * radius);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size}>
        {/* Graduations */}
        {grid.map((r, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            stroke={theme.colors.border.subtle}
            strokeWidth={0.5}
            fill="none"
          />
        ))}
        {/* Axes */}
        {angles.map((a, i) => (
          <Line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + radius * Math.cos(a)}
            y2={cy + radius * Math.sin(a)}
            stroke={theme.colors.border.subtle}
            strokeWidth={0.5}
          />
        ))}
        {/* Polygone du Palais/ADN */}
        <Polygon points={points} fill={fill} stroke={stroke} strokeWidth={2} />
        {/* Labels */}
        {axes.map((axis, i) => {
          const angle = angles[i] ?? 0;
          const x = cx + labelRadius * Math.cos(angle);
          const y = cy + labelRadius * Math.sin(angle);
          // L'axe ENV. négatif est lu côté opposé : on affiche le pôle gagnant
          const dominantLabel = axis.value >= 0 ? axis.posLabel : axis.negLabel;
          return (
            <SvgText
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize={10}
              fill={theme.colors.text.secondary}
            >
              {dominantLabel}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
