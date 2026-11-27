import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "../primitives/Ico";

export function PlaceRatingBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  const { colors, radius, typography: { preset } } = useTheme();
  if (!Number.isFinite(score) || score <= 0 || score > 5) return null;
  const value = score.toLocaleString("fr-FR", {maximumFractionDigits: 1});
  return <View accessible accessibilityLabel={value + " sur 5"} style={{
    flexDirection:"row", alignItems:"center", alignSelf:"flex-start", flexShrink:0,
    paddingVertical:compact ? 4 : 5, paddingHorizontal:compact ? 7 : 9, gap:4, borderRadius:radius.md,
    backgroundColor:colors.surface.recommendation,
  }}>
    <Ico name="star" filled size={compact ? 13 : 16} color={colors.text.onBrand}/>
    <Text style={{...preset.h3,fontSize:compact ? 16 : 20,lineHeight:compact ? 21 : 25,color:colors.text.onBrand}}>
      {value}<Text style={{...preset.caption,color:colors.text.onBrand}}>/5</Text>
    </Text>
  </View>;
}
