// Story 3.3c — Masthead canonique (UX spec §1287).
// Bandeau daté en tête du HomeD : wordmark SPAWT + date format français court.

import { Text, View } from "react-native";
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

export function Masthead({ date, kicker }: Props) {
  const theme = useTheme();
  const formatted = FR_DATE_FORMATTER.format(date ?? new Date());
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.base,
        paddingBottom: theme.spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Wordmark size={26} asHeader />
      <View style={{ alignItems: "flex-end" }}>
        {kicker ? (
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
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
          }}
        >
          {formatted}
        </Text>
      </View>
    </View>
  );
}
