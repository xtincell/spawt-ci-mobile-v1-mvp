import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

export function DataLoadNotice({ loading, failed, onRetry }: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!loading && !failed) return null;
  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
      {loading ? <ActivityIndicator accessibilityLabel={t("common.loading")} color={theme.colors.brand.primary} /> : (
        <>
          <Text accessibilityRole="alert" style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>
            {t("common.data_read_error")}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.retry")} onPress={onRetry}
            style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ ...theme.typography.preset.body, color: theme.colors.brand.accent }}>{t("common.retry")}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
