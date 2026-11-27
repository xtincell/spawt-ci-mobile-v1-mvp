// Story 3.3c — Masthead canonique (UX spec §1287).
// Bandeau daté en tête du HomeD : wordmark SPAWT + date format français court.

import { Image, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Wordmark } from "./primitives/Wordmark";

interface Props {
  /** Override (testing). Défaut: now(). */
  date?: Date;
  /** Optionnel — kicker overline en bas. */
  kicker?: string;
}

const FR_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const FR_COMPACT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export function Masthead({ date, kicker }: Props) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const shortDate = width / Math.max(1, fontScale) < 360;
  const editionDate = date ?? new Date();
  const formatted = FR_DATE_FORMATTER.format(editionDate);
  return (
    <View
      style={{
        paddingLeft: theme.spacing.base,
        paddingRight: theme.spacing.md,
        paddingVertical: theme.spacing.base,
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: theme.spacing.base,
        rowGap: theme.spacing.xs,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
        <Image
          accessible={false}
          source={require("../../assets/brand/logo-icon.png")}
          resizeMode="contain"
          style={{ width: 26, height: 34 }}
        />
        <Wordmark size={26} asHeader />
      </View>
      <View style={{ alignItems: "flex-end", maxWidth: "100%", marginLeft: "auto" }}>
        {kicker && !shortDate ? (
          <Text
            style={{
              ...theme.typography.preset.overline,
              color: theme.colors.text.tertiary,
            }}
          >
            {kicker}
          </Text>
        ) : null}
        <Text
          accessibilityLabel={formatted}
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
          }}
        >
          {shortDate ? FR_COMPACT_DATE.format(editionDate) : formatted}
        </Text>
      </View>
    </View>
  );
}
