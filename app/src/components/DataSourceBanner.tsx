import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { dataSourceMode, isDemoMode } from "../lib/data-source";

export function DataSourceBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  if (dataSourceMode === "supabase") return null;
  return (
    <View
      style={{
        backgroundColor: isDemoMode ? theme.colors.surface.subtle : theme.colors.state.warning,
        paddingVertical: 6,
        paddingHorizontal: theme.spacing.base,
      }}
    >
      <Text
        style={{
          ...theme.typography.preset.caption,
          color: isDemoMode ? theme.colors.text.secondary : theme.colors.text.onBrand,
          textAlign: "center",
        }}
      >
        {t(isDemoMode ? "common.dataSourceBanner" : "common.catalogue_unavailable")}
      </Text>
    </View>
  );
}
