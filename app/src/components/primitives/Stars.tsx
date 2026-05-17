// Étoiles de notation — drift D7 corrigé : max=5 par défaut (vs kit JSX max=4).
// Support des notes fractionnaires via SVG : une note 4.7 rend 4 étoiles pleines
// + 1 étoile à 70 % remplie (clip horizontal). `value` est arrondi au demi-point
// le plus proche pour une lecture fidèle (4.7 → 4.5 affiché).

import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, ClipPath, Rect, Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

// Étoile 5 branches 24×24, dessinée tracé fermé pour fill clean.
const STAR_PATH =
  "M12 2 L14.59 8.36 L21.45 8.91 L16.18 13.4 L17.77 20.09 L12 16.45 L6.23 20.09 L7.82 13.4 L2.55 8.91 L9.41 8.36 Z";

export function Stars({ value, max = 5, size = 12, color, accessibilityLabel }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  // Identifiant unique par instance : évite la collision `ClipPath#id` quand
  // plusieurs <Stars> rendent sur le même écran (web `react-native-web`).
  const uid = useId();
  const fill = color ?? theme.colors.brand.primary;
  const empty = theme.colors.text.tertiary;
  const safe = Number.isFinite(value) ? value : 0;
  // Arrondi au demi-point : 4.2 → 4.0, 4.3 → 4.5, 4.7 → 4.5, 4.8 → 5.0.
  const rounded = Math.max(0, Math.min(Math.round(safe * 2) / 2, max));

  return (
    <View
      style={{ flexDirection: "row", gap: 1 }}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? t("a11y.stars", { count: rounded, max })}
      importantForAccessibility="yes"
    >
      {Array.from({ length: max }).map((_, i) => {
        const delta = rounded - i;
        const ratio = delta >= 1 ? 1 : delta >= 0.5 ? 0.5 : 0;
        const clipId = `clip-${uid}-${i}-${ratio}`;
        return (
          <Svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            importantForAccessibility="no-hide-descendants"
          >
            <Defs>
              <ClipPath id={clipId}>
                <Rect x="0" y="0" width={24 * ratio} height="24" />
              </ClipPath>
            </Defs>
            <Path d={STAR_PATH} fill={empty} />
            {ratio > 0 ? (
              <Path d={STAR_PATH} fill={fill} clipPath={`url(#${clipId})`} />
            ) : null}
          </Svg>
        );
      })}
    </View>
  );
}
