import { Link } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import review from "../data/le-cha-review.json";
import { useTheme } from "../theme/ThemeProvider";
import { SpawterAvatar } from "./SpawterAvatar";
import { Stars } from "./primitives/Stars";
import { Ico } from "./primitives/Ico";

export function LeChaReviewLink({ placeId }: { placeId: string }) {
  const { colors, typography: { preset }, spacing, radius } = useTheme();
  if (placeId !== review.placeId) return null;
  return (
    <Link href={{ pathname: "/lieu/[id]/avis/alexandre", params: { id: placeId } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={review.linkLabel} testID="le-cha-open-review"
        style={{ gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surface.editorial }}>
        <View style={{flexDirection: "row", alignItems: "center", gap: spacing.sm}}>
          <SpawterAvatar url={null}/><View style={{flex: 1}}>
            <Text style={{...preset.body, color: colors.text.primary}}>{review.author}</Text>
            <Text style={{...preset.small, color: colors.text.secondary}}>{review.stage}</Text>
          </View><Stars value={review.overallScore} size="sm"/><Text style={{...preset.small, color:colors.text.primary}}>{review.overallScore}/5</Text>
        </View>
        <View style={{flexDirection: "row", flexWrap: "wrap", gap: spacing.base}}>
          {review.ratings.map(r => <View key={r.label}>
            <Text style={{...preset.small, color:colors.text.secondary}}>{r.label}</Text>
            <Text style={{...preset.h3, color:colors.text.primary}}>{String(r.value).replace(".", ",")}/5</Text>
          </View>)}
        </View>
        <Text numberOfLines={4} style={{...preset.body, color:colors.text.primary}}>{review.quote}</Text>
        <Image source={require("../../assets/editorial/le-cha.jpg")} resizeMode="cover" accessible accessibilityLabel={review.photoAlt}
          style={{width:"100%", height:170, borderRadius:radius.md}}/>
        <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between"}}>
          <Text style={{...preset.small, color:colors.brand.accent}}>{review.linkLabel}</Text><Ico name="chevron-right" size={18}/>
        </View>
      </Pressable>
    </Link>
  );
}
