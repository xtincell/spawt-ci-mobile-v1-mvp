// Story 3.1 — onglet Carte stub (V1.5 livrera la carte fonctionnelle).
// EmptyState "le chat tousse" — onboarding gracieux pour la coquille navigation.

import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import { DataSourceBanner } from "../../src/components/DataSourceBanner";
import { EmptyState } from "../../src/components/EmptyState";

export default function CarteScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <DataSourceBanner />
      <EmptyState
        icon="map"
        title={t("empty_state.map_title")}
        body={t("empty_state.map_body")}
      />
    </SafeAreaView>
  );
}
