import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ico } from "../../../../src/components/primitives/Ico";
import { Stars } from "../../../../src/components/primitives/Stars";
import { SpawterAvatar } from "../../../../src/components/SpawterAvatar";
import review from "../../../../src/data/le-cha-review.json";
import { useTheme } from "../../../../src/theme/ThemeProvider";

const meal = require("../../../../assets/editorial/le-cha.jpg");
const front = require("../../../../assets/editorial/le-cha-devanture.jpg");

export default function LeChaReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography: { preset }, radius } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  if (id !== review.placeId) return <Redirect href="/" />;

  const bodyWidth = Math.min(560, width - spacing.base * 2);
  const stacked = bodyWidth < 310 || fontScale > 1.35;
  const imageWidth = Math.round(stacked ? Math.min(260, bodyWidth) : bodyWidth * 0.53);
  const visitPlace = () => router.push({ pathname: "/place/[id]", params: { id } });

  const hasHistory = router.canGoBack();
  const backLabel = t(hasHistory ? "place.back" : "pilot.open_place");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: spacing.sm }}>
        <View style={{ width: bodyWidth, gap: spacing.base, paddingBottom: spacing.xl }}>
          <Pressable accessibilityRole="button" accessibilityLabel={backLabel}
            onPress={() => hasHistory ? router.back() : router.replace({ pathname: "/place/[id]", params: { id } })}
            style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start" }}>
            <Ico name="arrow-left" size={21} />
            <Text style={{ ...preset.small, color: colors.text.secondary }}>{backLabel}</Text>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.base }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...preset.overline, color: colors.brand.accent }}>{review.area} · {review.city}</Text>
              <Text testID="le-cha-review-title" accessibilityRole="header"
                style={{ ...preset.display, color: colors.text.primary }}>{review.name}</Text>
            </View>
            <Image source={front} accessible accessibilityLabel={review.frontAlt} resizeMode="cover"
              style={{ width: 68, height: 68, borderRadius: radius.md }} />
          </View>
          <View style={{ borderTopWidth: 1, borderColor: colors.border.subtle, paddingTop: spacing.base,
            flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <SpawterAvatar url={null} size={42} />
              <View>
                <Text style={{ ...preset.h3, color: colors.text.primary }}>{review.author}</Text>
                <Text style={{ ...preset.small, color: colors.text.secondary }}>{review.stage}</Text>
              </View>
            </View>
            <View accessible accessibilityLabel={review.overallScore + "/5"} style={{ alignItems: "flex-end" }}>
              <Text style={{ ...preset.h2, color: colors.text.primary }}>{review.overallScore}/5</Text>
              <Stars value={review.overallScore} size="sm" />
            </View>
          </View>
          <View style={{ flexDirection: stacked ? "column" : "row", alignItems: stacked ? "center" : "stretch",
            borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface.editorial }}>
            <Image source={meal} testID="le-cha-review-photo" accessible accessibilityLabel={review.photoAlt}
              resizeMode="contain" style={{ width: imageWidth, height: imageWidth * 4 / 3 }} />
            <View style={{ flex: stacked ? undefined : 1, alignSelf: "stretch", justifyContent: "space-evenly",
              paddingHorizontal: spacing.base, paddingVertical: spacing.sm, gap: spacing.sm }}>
              {review.ratings.map(rating => {
                const value = String(rating.value).replace(".", ",") + "/5";
                return (
                  <View key={rating.label} accessible accessibilityLabel={rating.label + " " + value}>
                    <Text style={{ ...preset.small, color: colors.text.secondary }}>{rating.label}</Text>
                    <Text style={{ ...preset.h2, color: colors.text.primary }}>{value}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <Text testID="le-cha-review-comment" style={{ ...preset.body, lineHeight: 25, color: colors.text.primary }}>
            {review.quote}
          </Text>
          {hasHistory && <Pressable onPress={visitPlace} accessibilityRole="link"
            style={{ minHeight: 48, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.sm }}>
            <Ico name="pin" color={colors.brand.accent} size={18} />
            <Text style={{ ...preset.small, color: colors.brand.accent, textDecorationLine: "underline" }}>{t("pilot.open_place")}</Text>
          </Pressable>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
