import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import type { ModeKey } from "./ModeStories";

/** Five vector drawings on one 24 × 24 grid; no bitmap assets. */
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
            <Path d="m10 3 2.5 6.5L19 12l-6.5 2.5L10 21l-2.5-6.5L1 12l6.5-2.5Z" />
            <Path
              d="m20 2 .8 2.2L23 5l-2.2.8L20 8l-.8-2.2L17 5l2.2-.8Z"
              stroke={gold}
            />
          </>
        ) : mode === "rapide" ? (
          <>
            <Path d="M14 2 4 14h7l-1 8L21 9h-8Z" />
            <Path d="m14 5-7 8h6l-1 6 7-9h-6Z" stroke={gold} />
          </>
        ) : mode === "duo" ? (
          <>
            <Path d="M12 7C9 1 1 4 2 9c0 4 6 8 10 11" />
            <Path d="M12 7c2-4 6-4 8-1" stroke={gold} />
            <Path d="M16 10c-4-4-9 1-5 5l5 5 5-5c4-4-1-9-5-5Z" stroke={gold} />
          </>
        ) : mode === "spots" ? (
          <>
            <Path d="M12 22S3 13 3 9a9 9 0 0 1 18 0c0 4-9 13-9 13Z" />
            <Circle cx={12} cy={9} r={3} fill={gold} stroke={gold} />
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
