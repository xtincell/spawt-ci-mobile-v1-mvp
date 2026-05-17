// Set d'icônes canoniques SPAWT — 24x24, stroke 1.6, currentColor.
// Cf. midfi-kit.jsx ligne 83. 29 icônes nommées + default cercle.
// `color` par défaut = theme.colors.text.primary (équivalent currentColor).

import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";

export type IconName =
  | "home"
  | "compass"
  | "map"
  | "user"
  | "plus"
  | "search"
  | "filter"
  | "star"
  | "heart"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "close"
  | "chevron-right"
  | "chevron-left"
  | "chevron-down"
  | "lock"
  | "lock-open"
  | "pin"
  | "crown"
  | "gold-circle"
  | "camera"
  | "send"
  | "share"
  | "clock"
  | "walk"
  | "sliders"
  | "bell"
  | "check";

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
}

export function Ico({ name, size = 20, color, filled = false }: Props) {
  const theme = useTheme();
  const stroke = color ?? theme.colors.text.primary;
  const fill = filled ? stroke : "none";
  // Props communs à tous les <Path> (sauf cas spéciaux comme `pin` ou `sliders`).
  const common = {
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  const svg = (children: ReactNode) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {children}
    </Svg>
  );

  switch (name) {
    case "home":
      return svg(<Path {...common} d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z" fill={fill} />);
    case "compass":
      return svg(
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Path {...common} d="M16 8 L13 13 L8 16 L11 11 Z" fill={fill} />
        </>,
      );
    case "map":
      return svg(
        <>
          <Path {...common} d="M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z" />
          <Path {...common} d="M9 4 V18 M15 6 V20" />
        </>,
      );
    case "user":
      return svg(
        <>
          <Circle cx={12} cy={8} r={4} {...common} fill={fill} />
          <Path {...common} d="M4 21 C4 16 7 14 12 14 C17 14 20 16 20 21" fill={fill} />
        </>,
      );
    case "plus":
      return svg(<Path {...common} d="M12 5 V19 M5 12 H19" />);
    case "search":
      return svg(
        <>
          <Circle cx={11} cy={11} r={7} {...common} />
          <Path {...common} d="M16 16 L20 20" />
        </>,
      );
    case "filter":
      return svg(<Path {...common} d="M3 5 H21 L14 13 V20 L10 18 V13 Z" />);
    case "star":
      return svg(
        <Path
          {...common}
          d="M12 3 L14.5 9 L21 9.7 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.7 L9.5 9 Z"
          fill={fill}
        />,
      );
    case "heart":
      return svg(
        <Path
          {...common}
          d="M12 20 C5 15 3 10.5 3 7.5 A4.5 4.5 0 0 1 12 5 A4.5 4.5 0 0 1 21 7.5 C21 10.5 19 15 12 20 Z"
          fill={fill}
        />,
      );
    case "arrow-right":
      return svg(<Path {...common} d="M5 12 H19 M13 6 L19 12 L13 18" />);
    case "arrow-left":
      return svg(<Path {...common} d="M19 12 H5 M11 6 L5 12 L11 18" />);
    case "arrow-up":
      return svg(<Path {...common} d="M12 19 V5 M6 11 L12 5 L18 11" />);
    case "arrow-down":
      return svg(<Path {...common} d="M12 5 V19 M6 13 L12 19 L18 13" />);
    case "close":
      return svg(<Path {...common} d="M6 6 L18 18 M18 6 L6 18" />);
    case "chevron-right":
      return svg(<Path {...common} d="M9 6 L15 12 L9 18" />);
    case "chevron-left":
      return svg(<Path {...common} d="M15 6 L9 12 L15 18" />);
    case "chevron-down":
      return svg(<Path {...common} d="M6 9 L12 15 L18 9" />);
    case "lock":
      return svg(
        <>
          <Rect x={5} y={11} width={14} height={9} rx={2} {...common} />
          <Path {...common} d="M8 11 V8 A4 4 0 0 1 16 8 V11" />
        </>,
      );
    case "lock-open":
      return svg(
        <>
          <Rect x={5} y={11} width={14} height={9} rx={2} {...common} />
          <Path {...common} d="M8 11 V8 A4 4 0 0 1 14 5" />
        </>,
      );
    case "pin":
      return svg(
        <>
          <Path
            {...common}
            d="M12 22 C12 22 4 14 4 9 A8 8 0 0 1 20 9 C20 14 12 22 12 22 Z"
            fill={fill}
          />
          <Circle
            cx={12}
            cy={9}
            r={2.5}
            stroke={filled ? theme.colors.surface.raised : stroke}
            strokeWidth={1.6}
            fill={filled ? theme.colors.surface.raised : "none"}
          />
        </>,
      );
    case "crown":
      return svg(
        <Path {...common} d="M3 7 L8 12 L12 6 L16 12 L21 7 V18 H3 Z" fill={fill} />,
      );
    case "gold-circle":
      return svg(
        <>
          <Circle cx={12} cy={12} r={9} {...common} fill={fill} />
          <Path
            {...common}
            d="M9 12 L11 14 L15 9"
            stroke={filled ? theme.colors.surface.inverse : stroke}
          />
        </>,
      );
    case "camera":
      return svg(
        <>
          <Path {...common} d="M3 8 H7 L9 6 H15 L17 8 H21 V18 H3 Z" />
          <Circle cx={12} cy={13} r={3.5} {...common} />
        </>,
      );
    case "send":
      return svg(<Path {...common} d="M3 11 L21 4 L14 21 L11 13 Z" />);
    case "share":
      return svg(
        <>
          <Circle cx={6} cy={12} r={2.5} {...common} />
          <Circle cx={18} cy={6} r={2.5} {...common} />
          <Circle cx={18} cy={18} r={2.5} {...common} />
          <Path {...common} d="M8 11 L16 7 M8 13 L16 17" />
        </>,
      );
    case "clock":
      return svg(
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Path {...common} d="M12 7 V12 L15 14" />
        </>,
      );
    case "walk":
      return svg(
        <>
          <Circle cx={13} cy={4} r={2} {...common} />
          <Path {...common} d="M9 22 L11 14 L8 11 V8 L13 7 L17 11 L20 12 M11 14 L15 16 L17 22" />
        </>,
      );
    case "sliders":
      return svg(
        <>
          <Path {...common} d="M4 7 H20 M4 12 H20 M4 17 H20" />
          <Circle cx={9} cy={7} r={2} stroke={stroke} strokeWidth={1.6} fill={theme.colors.surface.raised} />
          <Circle cx={15} cy={12} r={2} stroke={stroke} strokeWidth={1.6} fill={theme.colors.surface.raised} />
          <Circle cx={11} cy={17} r={2} stroke={stroke} strokeWidth={1.6} fill={theme.colors.surface.raised} />
        </>,
      );
    case "bell":
      return svg(
        <>
          <Path {...common} d="M6 17 V11 A6 6 0 0 1 18 11 V17 L20 19 H4 Z" />
          <Path {...common} d="M10 22 H14" />
        </>,
      );
    case "check":
      return svg(<Path {...common} d="M5 12 L10 17 L19 7" />);
    default:
      // Le default du kit JSX rend un cercle simple. Garde-fou si on étend
      // IconName mais oublie une case (TS attrape la plupart des oublis).
      return svg(<Circle cx={12} cy={12} r={9} {...common} />);
  }
}
