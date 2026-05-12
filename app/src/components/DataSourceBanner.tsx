// Bandeau qui affiche le mode de données actif (debug + transparence dev)
// Disparaît en mode supabase. Utile en démo pour rappeler "ces lieux sont seedés".

import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { dataSourceMode } from "../lib/data-source";

export function DataSourceBanner() {
  const theme = useTheme();
  if (dataSourceMode === "supabase") return null;
  return (
    <View
      style={{
        backgroundColor: theme.colors.state.warning,
        paddingVertical: 6,
        paddingHorizontal: theme.spacing.base,
      }}
    >
      <Text
        style={{
          color: theme.colors.text.onBrand,
          fontSize: theme.typography.size.xs,
          fontWeight: theme.typography.weight.medium,
          textAlign: "center",
        }}
      >
        Mode démo · données locales · Supabase pas encore branché
      </Text>
    </View>
  );
}
