import { useState } from "react";
import { Image, Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import type { Place } from "../../types/place";
import type { PlacePractical } from "../../lib/place-practical";
import review from "../../data/le-cha-review.json";
import { PlaceReviewAttribution } from "./PlaceReviewAttribution";

export function PlaceIdentity({ place, practical, score, reviewCount, onReviews, revision }: {
  place:Place; practical:PlacePractical|null; score:number; reviewCount:number; onReviews:()=>void; revision:string;
}) {
  const {t} = useTranslation();
  const {spacing, colors, radius, typography:{preset}} = useTheme();
  const compact = useWindowDimensions().width < 375;
  const logoSize = compact ? 40 : 52;
  const [avatarAttempt, setAvatarAttempt] = useState(0);
  const known = place.id === review.placeId;
  const photos = [
    place.logo_url ? {source:{uri:place.logo_url},type:"logo"} : null,
    known ? {source:require("../../../assets/editorial/le-cha-logo-profil.webp"),type:"logo"} : null,
    place.signage_url ? {source:{uri:place.signage_url},type:"sign"} : null,
    known ? {source:require("../../../assets/editorial/le-cha-enseigne.webp"),type:"crop"} : null,
  ].filter(item=>item!=null);
  const photo=photos[avatarAttempt];
  const description = place.editorial_profile?.identity || practical?.official_description;
  const specialties = place.editorial_profile?.specialties;
  const cuisine = place.cuisine.map(c => t("cuisine." + c, {defaultValue:c})).join(" · ");
  return <View style={{gap:spacing.sm}}>
    <View style={{flexDirection:"row",alignItems:"flex-start",gap:spacing.sm}}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:logoSize,height:logoSize,flexShrink:0,alignItems:"center",justifyContent:"center",overflow:"hidden",borderRadius:radius.lg,backgroundColor:colors.surface.base,borderWidth:1,borderColor:colors.border.subtle}}>
        {photo ? <Image accessible={false}
          source={photo.source} resizeMode={photo.type === "logo" ? "contain" : "cover"} style={{width:"100%",height:"100%",transform:[{scale:photo.type==="sign" ? 1.55 : 1}]}} onError={() => setAvatarAttempt(n => n + 1)}/> :
          <Text adjustsFontSizeToFit numberOfLines={4} style={{...preset.h3,padding:3,color:colors.text.primary,textAlign:"center"}}>{place.name}</Text>}
      </View>
      <View style={{flex:1,minWidth:0,gap:2}}>
        <Text accessibilityRole="header" testID="place-identity-name" style={{...preset.display,...(compact ? {fontSize:26,lineHeight:32} : {}),color:colors.text.primary,minWidth:0}}>{place.name}</Text>
        {cuisine ? <Text style={{...preset.overline,color:colors.brand.accent}}>{cuisine}</Text> : null}
        <Text style={{...preset.small,color:colors.text.secondary}}>{[place.location.neighborhood,place.location.city].filter(Boolean).join(" · ")}</Text>
      </View>
      {reviewCount > 0 ? <PlaceReviewAttribution score={score} compact={compact} placeId={place.id} reviewCount={reviewCount} onPress={onReviews} revision={revision}/> : null}
    </View>
    {description ? <Text style={{...preset.body,color:colors.text.primary}}>{description}</Text> : null}
    {specialties ? <Text style={{...preset.small,color:colors.text.secondary}}><Text style={{fontWeight:"700"}}>{t("editorial.specialties")} · </Text>{specialties}</Text> : null}
    {known ? <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs}}>{(["taste","service","decor"] as const).map((key,i) =>
      <Text key={key} accessibilityLabel={t("place.alexandre_observation", {tag:t("place.lecha_"+key)})} style={{...preset.caption,backgroundColor:i===1?colors.surface.subtle:colors.surface.editorial,color:colors.text.primary,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.md}}>{t("place.lecha_"+key)}</Text>)}</View> : null}
  </View>;
}
