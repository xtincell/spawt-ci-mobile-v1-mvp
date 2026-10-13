import { ScrollView, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ExploreCollections } from "../src/components/ExploreCollections";
import { useFlag } from "../src/store/feature-flags";
import { useTheme } from "../src/theme/ThemeProvider";

export default function ExploreScreen() {
  const enabled = useFlag("mode-explore");
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  if (!enabled) return <Redirect href="/(tabs)" />;
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.subtle }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        onPress={() => router.back()}
        style={{
          minHeight: 44,
          justifyContent: "center",
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.primary,
          }}
        >
          {t("common.back")}
        </Text>
      </Pressable>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.lg }}>
        <Text
          accessibilityRole="header"
          style={{
            ...theme.typography.preset.h1,
            padding: theme.spacing.lg,
            color: theme.colors.text.primary,
          }}
        >
          {t("home.interfaces.selections.title")}
        </Text>
        <ExploreCollections />
      </ScrollView>
    </SafeAreaView>
  );
}
