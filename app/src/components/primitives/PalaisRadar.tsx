// Radar pentagonal du Palais — 5 axes, fill vert chat à 18% d'opacité.
// Cf. midfi-kit.jsx ligne 156 + ux-design-spec § "Palais radar".
//
// Sémantique « En construction » (cf. PRD §8.2) : si `underConstruction` est
// vrai, le radar est rendu à opacité réduite et l'overlay textuel (i18n côté
// caller via `underConstructionLabel`) signale l'état. C'est le anti-mensonge
// user — pas de score affiché tant que la confidence < 0.3.

import { Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";

type FiveTuple = readonly [number, number, number, number, number];
type Index = 0 | 1 | 2 | 3 | 4;
const INDICES: readonly Index[] = [0, 1, 2, 3, 4] as const;

interface Props {
  values: FiveTuple;
  labels?: readonly [string, string, string, string, string];
  size?: number;
  fill?: string;
  underConstruction?: boolean;
  underConstructionLabel?: string;
}

const DEFAULT_LABELS: readonly [string, string, string, string, string] = [
  "Nomade",
  "Foule",
  "Maquis",
  "Exigeant",
  "Horizons",
];

// Pentagone régulier — sommet en haut (0°). Angles en radians.
const angleRad = (i: Index): number => ((72 * i - 90) * Math.PI) / 180;

export function PalaisRadar({
  values,
  labels = DEFAULT_LABELS,
  size = 200,
  fill,
  underConstruction = false,
  underConstructionLabel,
}: Props) {
  const theme = useTheme();
  const stroke = fill ?? theme.colors.brand.accent;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;

  // Garde-fou : `values[i]` peut arriver NaN / Infinity (calcul amont sur 0 avis)
  // ou hors [0, 1] (data corrompue). Sans clamp, react-native-svg rend
  // `points="NaN,NaN ..."` qui crashe le driver SVG sur Android.
  const safe = (v: number): number =>
    Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
  const point = (i: Index, v: number): [number, number] => [
    cx + Math.cos(angleRad(i)) * r * safe(v),
    cy + Math.sin(angleRad(i)) * r * safe(v),
  ];

  const polyPts = INDICES.map((i) => point(i, values[i]).join(",")).join(" ");

  // Grilles : 4 polygones concentriques + 5 axes radiaux.
  const gridScales = [0.25, 0.5, 0.75, 1] as const;

  return (
    <View style={{ width: size, height: size, opacity: underConstruction ? 0.4 : 1 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gridScales.map((scale, idx) => {
          const pts = INDICES.map(
            (i) =>
              `${cx + Math.cos(angleRad(i)) * r * scale},${cy + Math.sin(angleRad(i)) * r * scale}`,
          ).join(" ");
          return (
            <Polygon
              key={idx}
              points={pts}
              fill="none"
              stroke={theme.colors.border.subtle}
              strokeWidth={1}
            />
          );
        })}
        {INDICES.map((i) => (
          // rgba(10,10,10,0.08) : grille radiale, dérivée translucide de
          // palette.black. Pas d'équivalent token (border.subtle = 0.10 plus
          // marqué). Documenter et garder inline.
          <Line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angleRad(i)) * r}
            y2={cy + Math.sin(angleRad(i)) * r}
            stroke="rgba(10,10,10,0.08)"
            strokeWidth={1}
          />
        ))}
        <Polygon
          points={polyPts}
          fill={stroke}
          fillOpacity={0.18}
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        {INDICES.map((i) => {
          const [x, y] = point(i, values[i]);
          return <Circle key={i} cx={x} cy={y} r={3} fill={stroke} />;
        })}
        {INDICES.map((i) => {
          const [x, y] = point(i, 1.18);
          return (
            <SvgText
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              fontFamily={theme.typography.preset.overline.fontFamily}
              fontSize={9}
              fontWeight="700"
              fill={theme.colors.text.primary}
              // ls 0.08em × 9 ≈ 0.72 — plus tight que preset.overline (1.2),
              // adapté à l'usage dense des labels radar.
            >
              {(labels[i] || DEFAULT_LABELS[i]).toUpperCase()}
            </SvgText>
          );
        })}
      </Svg>
      {underConstruction && underConstructionLabel ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.text.secondary,
            }}
          >
            {underConstructionLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
