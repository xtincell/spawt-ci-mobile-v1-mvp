import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { getPublicReviewAuthorCount } from "../../lib/place-practical";
import { useTheme } from "../../theme/ThemeProvider";

export function PlaceReviewAttribution({ placeId, reviewCount, onPress, revision }: {
  placeId:string; reviewCount:number; onPress:()=>void; revision:string;
}) {
  const { t } = useTranslation();
  const { colors, typography:{preset} } = useTheme();
  const [exact, setExact] = useState<{key:string; count:number} | null>(null);
  const key = [placeId,reviewCount,revision].join("|");
  useEffect(() => {
    if (reviewCount < 2) return;
    let active = true;
    void getPublicReviewAuthorCount(placeId).then(count => {
      if (active && count !== null && count > 0) setExact({key, count});
    }).catch(() => undefined);
    return () => { active = false; };
  }, [key, placeId, reviewCount]);
  const count = reviewCount === 1 ? 1 : exact?.key === key ? exact.count : null;
  const label = count !== null ? t("place.rating_authors", {count}) : t("place.rating_reviews", {count:reviewCount});
  return <Pressable accessibilityRole="button" onPress={onPress} testID="place-rating-authors"
    style={{minHeight:42,justifyContent:"center",alignSelf:"flex-start",flexShrink:1}}>
    <Text style={{...preset.small,color:colors.brand.accent,textDecorationLine:"underline"}}>{label}</Text>
  </Pressable>;
}
