// Pin de lieu — goutte or + point noir au centre.
// Cf. midfi-kit.jsx ligne 44 (SpawtPin renommé Pin : préfixe Spawt interdit
// sur les primitives techniques, project-context § "Convention de naming").

import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  size?: number;
  color?: string;
}

export function Pin({ size = 18, color }: Props) {
  const theme = useTheme();
  const fill = color ?? theme.colors.brand.primary;
  const dot = theme.colors.surface.inverse;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 22 C12 22 4 14 4 9 A8 8 0 0 1 20 9 C20 14 12 22 12 22 Z" fill={fill} />
      <Circle cx={12} cy={9} r={3} fill={dot} />
    </Svg>
  );
}
