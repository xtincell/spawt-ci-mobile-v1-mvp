import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getPublicReviewAuthors, type ReviewAuthorSummary } from "../../lib/place-practical";
import { useTheme } from "../../theme/ThemeProvider";
import { SpawterAvatar } from "../SpawterAvatar";
import { PlaceRatingBadge } from "./PlaceRatingBadge";

export function PlaceReviewAttribution({ placeId, score, compact=false, reviewCount, onPress, revision }: {
  placeId:string; score:number; compact?:boolean; reviewCount:number; onPress:()=>void; revision:string;
}) {
  const { t } = useTranslation();
  const { colors, radius, typography:{preset} } = useTheme();
  const [result, setResult] = useState<{key:string; authors:ReviewAuthorSummary} | null>(null);
  const key = [placeId,reviewCount,revision].join("|");
  useEffect(() => {
    if (!reviewCount) return;
    let active = true;
    void getPublicReviewAuthors(placeId).then(authors => {
      if (active && authors) setResult({key, authors});
    }).catch(() => undefined);
    return () => { active = false; };
  }, [key, placeId, reviewCount]);
  if (!reviewCount) return null;
  const authors = result?.key === key ? result.authors : null;
  const label = authors?.count ? t("place.rating_authors", {count:authors.count}) : t("place.rating_reviews", {count:reviewCount});
  const remaining = authors ? authors.count - authors.portraits.length : 0;
  const hasScore = Number.isFinite(score) && score > 0 && score <= 5;
  const spoken = hasScore ? t("place.rating_attribution", {score:score.toLocaleString("fr-FR", {maximumFractionDigits:1}), attribution:label}) : label;
  return <Pressable accessible accessibilityRole="button" accessibilityLabel={spoken} onPress={onPress} testID="place-rating-authors"
    style={{minHeight:44,width:compact ? 124 : 148,alignSelf:"flex-start",flexShrink:0,borderRadius:radius.md,
      borderWidth:1,borderColor:colors.brand.primary,backgroundColor:colors.surface.recommendation,paddingVertical:5,paddingHorizontal:6}}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden pointerEvents="none" style={{gap:2}}>
    <View style={{flexDirection:"row",alignItems:"center",gap:3}}>
      {hasScore ? <View testID="place-identity-score"><PlaceRatingBadge score={score} compact inline/></View> : null}
      {authors?.portraits.length ? <View style={{flexDirection:"row",alignItems:"center",flexShrink:1}}>
      {authors.portraits.map((author, index) => <View key={author.id}
        style={{padding:1,marginLeft:index ? -6 : 0,borderRadius:16,backgroundColor:colors.surface.base}}>
        <SpawterAvatar url={author.avatarUrl} size={compact ? 15 : 19} testID={`place-author-${author.id}`}/>
      </View>)}
      {remaining > 0 ? <Text numberOfLines={1} adjustsFontSizeToFit style={{...preset.caption,fontSize:10,color:colors.text.primary,marginLeft:2,flexShrink:1}}>+{remaining}</Text> : null}
      </View> : null}
    </View>
    <Text numberOfLines={2} style={{...preset.small,fontSize:compact ? 11 : 12,lineHeight:compact ? 14 : 16,color:colors.text.onBrand}}>{label}</Text>
    </View>
  </Pressable>;
}
