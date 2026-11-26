import { Link } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import review from "../data/le-cha-review.json";
import { useTheme } from "../theme/ThemeProvider";
import { Ico } from "./primitives/Ico";

export function LeChaReviewLink({ placeId }: { placeId: string }) {
  const { colors, typography: { preset }, spacing, radius } = useTheme();
  if (placeId !== review.placeId) return null;
  return (
    <Link href={{ pathname: "/lieu/[id]/avis/alexandre", params: { id: placeId } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={review.linkLabel} testID="le-cha-open-review"
        style={{ flexDirection: "row", gap: spacing.md, alignItems: "center", borderRadius: radius.md,
          padding: spacing.md, marginVertical: spacing.sm, backgroundColor: colors.surface.editorial }}>
        <Image source={require("../../assets/editorial/le-cha.jpg")} resizeMode="contain" style={{ width: 42, height: 56 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...preset.h3, color: colors.text.primary }}>{review.linkLabel}</Text>
          <Text style={{ ...preset.small, color: colors.text.secondary }}>{review.stage} · {review.overallScore}/5</Text>
        </View>
        <Ico name="chevron-right" size={20} />
      </Pressable>
    </Link>
  );
}
