import { ScrollView, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Announcements } from "../../src/components/Announcements";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function AnnouncementsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: theme.spacing.lg }}>
      <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>{t("common.back")}</Text>
    </Pressable>
    <ScrollView><Announcements {...(id ? { id } : {})} /></ScrollView>
  </SafeAreaView>;
}
