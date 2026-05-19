// Story 3.1 — onglet Meute stub (V1.5+ définira le scope final).
// EmptyState "le chat tousse" — placeholder gracieux.

import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import { DataSourceBanner } from "../../src/components/DataSourceBanner";
import { EmptyState } from "../../src/components/EmptyState";

export default function MeuteScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <DataSourceBanner />
      <EmptyState
        icon="compass"
        title={t("empty_state.meute_title")}
        body={t("empty_state.meute_body")}
      />
    </SafeAreaView>
  );
}
