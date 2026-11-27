import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { portalSelection } from "../../data/portal-selection";
import { useTheme } from "../../theme/ThemeProvider";
import { useFlag } from "../../store/feature-flags";
import { useContentRevision } from "../../lib/content-sync";
import { getPlaceSelections, type PlaceSelection } from "../../lib/place-selections";
import { Ico, type IconName } from "../primitives/Ico";
import { PlaceSectionHeader } from "./PlaceSectionHeader";
import { DataLoadNotice } from "../DataLoadNotice";
import type { PlaceSignal } from "../../types/place";

const emblems: Record<PlaceSignal, IconName> = {
  coup_de_coeur: "heart", pepite_verifiee: "gold-circle", institution: "crown", fidelite: "paw",
  decouverte: "compass", table_diverse: "users", noctambule_verifie: "clock",
};
export function PlaceRecognition({ placeId, name, signals }: {placeId: string; name: string; signals: readonly PlaceSignal[]}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, radius, typography: {preset} } = useTheme();
  const enabled = useFlag("mode-explore");
  const revision = useContentRevision();
  const [lists, setLists] = useState<PlaceSelection[]>([]);
  const [failed, setFailed] = useState(false);
  const [showPortal,setShowPortal] = useState(false);
  const [retry, setRetry] = useState(0);
  const {width} = useWindowDimensions();
  const size = Math.min(255, Math.max(184, width * 0.64));
  useEffect(() => {
    let current = true;
    setLists([]); setFailed(false);
    if (enabled) void getPlaceSelections(placeId)
      .then(rows => { if (current) setLists(rows); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [enabled, placeId, revision, retry]);
  const distinctions = signals.filter(signal => signal in emblems);
  const member = portalSelection.some(row => row.id === placeId);
  const portalTitle = t("place.portal_selection");
  const showEditorial = member && !lists.some(list => t(list.title_key) === portalTitle || list.slug === "les-trouvailles-de-la-bande");
  if (!distinctions.length && !lists.length && !showEditorial && !failed) return null;
  return <View style={{gap:spacing.sm}}>
    <PlaceSectionHeader title={t("place.recognitions")} icon="crown" eyebrow={name}/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:spacing.sm}}>
      {distinctions.map(signal => <View key={signal} style={{width:size, padding:spacing.base, gap:spacing.sm, borderRadius:radius.lg, backgroundColor:colors.surface.recommendation, justifyContent:"space-between"}}>
        <Ico name={emblems[signal]} size={40} color={colors.chat.djidji}/>
        <Text style={{...preset.overline, color:colors.chat.djidji}}>{t("place.spawt_signal")}</Text>
        <Text style={{...preset.h2, color:colors.text.primary}}>{t("place.signal_" + signal)}</Text>
      </View>)}
      {showEditorial ? <Pressable accessibilityRole="button" accessibilityLabel={portalTitle} onPress={()=>setShowPortal(true)}
        style={{width:size,borderRadius:radius.lg,overflow:"hidden",backgroundColor:colors.chat.djidji}}>
        <View style={{flexDirection:"row",height:83,gap:2}}>
          {portalSelection.map(row=><Image key={row.id} accessible={false} source={row.photo} resizeMode={row.name==="DipnDip"?"contain":"cover"}
            style={{flex:1,height:"100%",backgroundColor:colors.surface.base}}/>)}
        </View>
        <View style={{padding:spacing.base,gap:spacing.xs}}>
          <Text style={{...preset.overline,color:colors.surface.recommendation}}>{t("place.in_selection")}</Text>
          <Text style={{...preset.h2,color:colors.text.inverse}}>{portalTitle} ›</Text>
        </View>
      </Pressable> : null}
      {enabled && lists.map(list => <Pressable key={list.id} accessibilityRole="button" accessibilityLabel={t("explore.collection_open_aria", {title:t(list.title_key)})}
        onPress={() => router.push({pathname:"/explore/[slug]",params:{slug:list.slug}})}
        style={{width:size, borderRadius:radius.lg, overflow:"hidden", backgroundColor:colors.chat.djidji}}>
        {list.cover_url ? <Image source={{uri:list.cover_url}} resizeMode="cover" style={{width:"100%",height:85}}/> : null}
        <View style={{padding:spacing.base,gap:spacing.xs}}>
          <Ico name="map" size={22} color={colors.surface.recommendation}/>
          <Text style={{...preset.overline,color:colors.surface.recommendation}}>{t("place.in_selection")}</Text>
          <Text style={{...preset.h2,color:colors.text.inverse}}>{t(list.title_key)} ›</Text>
        </View>
      </Pressable>)}
    </ScrollView>
    {showPortal ? <Modal animationType="slide" onRequestClose={()=>setShowPortal(false)}>
      <ScrollView contentContainerStyle={{padding:spacing.lg,gap:spacing.base}}>
        <Pressable accessibilityRole="button" onPress={()=>setShowPortal(false)} style={{minHeight:44,alignItems:"flex-end",justifyContent:"center"}}><Text style={{...preset.body,color:colors.brand.accent}}>{t("common.close")}</Text></Pressable>
        <PlaceSectionHeader icon="map" title={portalTitle} eyebrow={t("place.in_selection")} meta={t("place.portal_selection_area")}/>
        {portalSelection.map(row=><Pressable key={row.id} accessibilityRole="button" onPress={()=>{
          setShowPortal(false);
          if(row.id!==placeId) router.push({pathname:"/place/[id]",params:{id:row.id}});
        }} style={{flexDirection:"row",minHeight:80,gap:spacing.base,alignItems:"center",borderBottomWidth:1,borderColor:colors.border.subtle,paddingVertical:spacing.sm}}>
          <Image accessible={false} source={row.photo} resizeMode={row.name==="DipnDip"?"contain":"cover"} style={{width:72,height:66,borderRadius:radius.md}}/>
          <View style={{flex:1}}><Text style={{...preset.h2,color:colors.text.primary}}>{row.name}</Text><Text style={{...preset.small,color:colors.text.secondary}}>{row.area}</Text></View>
          <Ico name="chevron-right" color={colors.brand.accent}/>
        </Pressable>)}
      </ScrollView>
    </Modal> : null}
    {failed ? <DataLoadNotice loading={false} failed onRetry={() => setRetry(n => n + 1)}/> : null}
  </View>;
}
