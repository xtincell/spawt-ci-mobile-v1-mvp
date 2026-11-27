import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import type { Place } from "../../types/place";
import type { PlacePractical } from "../../lib/place-practical";
import review from "../../data/le-cha-review.json";

export function PlaceIdentity({ place, practical }: {place: Place; practical: PlacePractical | null}) {
  const {t} = useTranslation();
  const {spacing, colors, radius, typography:{preset}} = useTheme();
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
    <View style={{flexDirection:"row",alignItems:"center",gap:spacing.base}}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:72,height:72,alignItems:"center",justifyContent:"center",overflow:"hidden",borderRadius:radius.lg,backgroundColor:colors.surface.base,borderWidth:1,borderColor:colors.border.subtle}}>
        {photo ? <Image accessible={false}
          source={photo.source} resizeMode={photo.type === "logo" ? "contain" : "cover"} style={{width:"100%",height:"100%",transform:[{scale:photo.type==="sign" ? 1.55 : 1}]}} onError={() => setAvatarAttempt(n => n + 1)}/> :
          <Text adjustsFontSizeToFit numberOfLines={4} style={{...preset.h3,padding:3,color:colors.text.primary,textAlign:"center"}}>{place.name}</Text>}
      </View>
      <View style={{flex:1,gap:2}}>
        {cuisine ? <Text style={{...preset.overline,color:colors.brand.accent}}>{cuisine}</Text> : null}
        <Text accessibilityRole="header" style={{...preset.display,color:colors.text.primary}}>{place.name}</Text>
        <Text style={{...preset.small,color:colors.text.secondary}}>{[place.location.neighborhood,place.location.city].filter(Boolean).join(" · ")}</Text>
      </View>
    </View>
    {description ? <Text style={{...preset.body,color:colors.text.primary}}>{description}</Text> : null}
    {specialties ? <Text style={{...preset.small,color:colors.text.secondary}}><Text style={{fontWeight:"700"}}>{t("editorial.specialties")} · </Text>{specialties}</Text> : null}
    {known ? <View style={{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs}}>{(["taste","service","decor"] as const).map((key,i) =>
      <Text key={key} accessibilityLabel={t("place.alexandre_observation", {tag:t("place.lecha_"+key)})} style={{...preset.caption,backgroundColor:i===1?colors.surface.subtle:colors.surface.editorial,color:colors.text.primary,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.md}}>{t("place.lecha_"+key)}</Text>)}</View> : null}
  </View>;
}
