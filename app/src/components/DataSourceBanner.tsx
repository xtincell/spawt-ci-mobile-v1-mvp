// Bandeau "Mode démo" — visible quand l'adapter tombe en fallback (Supabase
// non configuré). Disparaît en mode supabase. Re-skin Story 1.4 sur tokens
// canoniques (preset.caption Gotham-Medium 11 uppercase) + string i18n.

import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { dataSourceMode } from "../lib/data-source";

export function DataSourceBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
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
          ...theme.typography.preset.caption,
          color: theme.colors.text.onBrand,
          textAlign: "center",
        }}
      >
        {t("common.dataSourceBanner")}
      </Text>
    </View>
  );
}
