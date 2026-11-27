import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "../primitives/Ico";

/** An estimate from a granted GPS position, with the same assumptions as the approved sheet. */
export function PlaceTravel({km}: {km:number}) {
  const {t} = useTranslation();
  const {colors,spacing,radius,typography:{preset}} = useTheme();
  const [showMethod,setShowMethod]=useState(false);
  if (!Number.isFinite(km)) return null;
  const minutes = (speed:number) => Math.max(1, Math.round(km * 1.25 * 60 / speed));
  return <View style={{gap:spacing.xs}}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:showMethod}} onPress={() => setShowMethod(open=>!open)}
      style={{minHeight:44,alignSelf:"flex-start",alignItems:"center",flexDirection:"row",gap:spacing.sm,backgroundColor:colors.surface.subtle,borderRadius:radius.full,paddingHorizontal:spacing.base}}>
      <Ico name="walk" color={colors.brand.accent} size={17}/>
      <Text style={{...preset.small,color:colors.text.primary}}>{km <= 50 ? t("place.travel_estimate",{walk:minutes(4.5),drive:minutes(25)}) : t("place.travel_direct",{km:Math.round(km)})}</Text>
    </Pressable>
    {showMethod ? <Text style={{...preset.caption,color:colors.text.secondary}}>{t(km <= 50 ? "place.travel_method":"place.travel_direct_method")}</Text> : null}
  </View>;
}
