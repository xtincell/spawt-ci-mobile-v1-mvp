import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import type { ModeKey } from "./ModeStories";

/** Four original vector drawings on one 24 × 24 grid; no bitmap assets. */
export function HomeModeIcon({
  mode,
  active = false,
}: {
  mode: ModeKey;
  active?: boolean;
}) {
  const { colors } = useTheme();
  const ink = active ? colors.text.inverse : colors.text.primary;
  const gold = colors.brand.primary;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={26}
        height={26}
        viewBox="0 0 24 24"
        fill="none"
        stroke={ink}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {mode === "suggestions" ? (
          <>
            <Path d="M14 4a8 8 0 1 0 6 9M5 17l-2 4 6-2" />
            <Path
              d="m19 2 .9 3.1L23 6l-3.1.9L19 10l-.9-3.1L15 6l3.1-.9Z"
              stroke={gold}
            />
          </>
        ) : mode === "traine" ? (
          <>
            <Path d="M6 11V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v5M6 19v3M18 19v3" />
            <Path d="M6 15h12v-4a2 2 0 0 1 4 0v8H2v-8a2 2 0 0 1 4 0Z" />
            <Path d="M8 12h8" stroke={gold} />
          </>
        ) : mode === "decouvre" ? (
          <>
            <Circle cx={12} cy={12} r={9} />
            <Path d="m16 8-3 5-5 3 3-5Z" stroke={gold} />
          </>
        ) : (
          <>
            <Path d="M12 5C8 2 5 2 2 4v16c3-2 6-2 10 1 4-3 7-3 10-1V4c-3-2-6-2-10 1Z" />
            <Path d="M12 5v16" stroke={gold} />
          </>
        )}
      </Svg>
    </View>
  );
}
