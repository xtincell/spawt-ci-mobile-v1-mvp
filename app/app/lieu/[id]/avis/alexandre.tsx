import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ico } from "../../../../src/components/primitives/Ico";
import { Stars } from "../../../../src/components/primitives/Stars";
import { SpawterAvatar } from "../../../../src/components/SpawterAvatar";
import review from "../../../../src/data/le-cha-review.json";
import { useTheme } from "../../../../src/theme/ThemeProvider";

export default function LeChaReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, spacing, typography, radius } = useTheme();
  if (id !== review.placeId) return <Redirect href="/" />;
  const score = review.ratings.reduce((sum, rating) => sum + rating.value, 0) / review.ratings.length;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.base }}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
          accessibilityRole="button" accessibilityLabel={t("place.back")}
          style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center" }}>
          <Ico name="arrow-left" size={24} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: spacing.base, alignItems: "center" }}>
          <Image source={require("../../../../assets/editorial/le-cha-devanture.jpg")} accessible accessibilityLabel={review.frontAlt}
            style={{ width: 64, height: 78, borderRadius: radius.md }} />
          <View><Text style={{ ...typography.preset.small, color: colors.text.secondary }}>{review.area} · {review.city}</Text>
          <Text testID="le-cha-review-title" accessibilityRole="header"
            style={{ ...typography.preset.h1, color: colors.text.primary }}>{review.name}</Text></View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <SpawterAvatar url={null} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.preset.body, color: colors.text.primary, fontWeight: "700" }}>{review.author}</Text>
            <Text style={{ ...typography.preset.small, color: colors.text.secondary }}>{review.stage}</Text>
          </View>
          <Stars value={score} size="sm" />
          <Text style={{ ...typography.preset.body, color: colors.text.primary }}>{score}/5</Text>
        </View>
        <Text testID="le-cha-review-comment" style={{ ...typography.preset.body, color: colors.text.primary }}>{review.quote}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.base }}>
          {review.ratings.map(rating => (
            <Text key={rating.label} style={{ ...typography.preset.small, color: colors.text.secondary }}>
              {rating.label} {rating.value}/5
            </Text>
          ))}
        </View>
        <Image testID="le-cha-review-photo" source={require("../../../../assets/editorial/le-cha.jpg")}
          accessible accessibilityLabel={review.photoAlt} resizeMode="contain"
          style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.md }} />
        <Pressable onPress={() => router.push({ pathname: "/place/[id]", params: { id } })}
          accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }}>
          <Text style={{ ...typography.preset.body, color: colors.text.primary, textDecorationLine: "underline" }}>{t("pilot.open_place")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
