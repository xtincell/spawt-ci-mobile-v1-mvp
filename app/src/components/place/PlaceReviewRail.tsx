import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { SpawterAvatar } from "../SpawterAvatar";
import { Ico } from "../primitives/Ico";
import { ReviewCard } from "../ReviewCard";
import { STADE_DESCRIPTORS } from "../../types/stade";
import type { PlaceReview } from "../../lib/data-source";
import editorial from "../../data/le-cha-review.json";

export function PlaceReviewRail({placeId,reviews,onSeeAll}:{placeId:string;reviews:PlaceReview[];onSeeAll?:(()=>void)|undefined}) {
  const {t}=useTranslation();
  const theme=useTheme();
  const router=useRouter();
  const {spacing,colors,typography:{preset},radius}=theme;
  const {width}=useWindowDimensions();
  const [opened,setOpened]=useState<PlaceReview|null>(null);
  const editorialCard=placeId===editorial.placeId;
  if (!reviews.length && !editorialCard) return null;
  const cards=reviews.map(review=>({
    id:review.id, name:review.spawter_display_name, avatar:review.spawter_avatar_url,
    title:review.spawter_stage ? STADE_DESCRIPTORS[review.spawter_stage].label : undefined,
    score:review.note_globale ?? review.note_etoiles, text:review.texte_avis,
    photo:review.photos[0] ? {uri:review.photos[0]} : undefined,
    detail:()=>setOpened(review)
  }));
  if (editorialCard) cards.splice(Math.min(cards.length,2),0,{
    id:"alexandre",name:editorial.author,avatar:null,title:editorial.stage,score:editorial.overallScore,text:editorial.quote,
    photo:require("../../../assets/editorial/le-cha.jpg"),detail:()=>router.push({pathname:"/lieu/[id]/avis/alexandre",params:{id:placeId}})
  });
  const cardWidth=Math.max(184,Math.min(344,width-84));
  return <View style={{gap:spacing.sm}}>
    <Text accessibilityRole="header" style={{...preset.h3,color:colors.text.primary}}>{t("place.paroles")}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth+spacing.sm} decelerationRate="fast" contentContainerStyle={{gap:spacing.sm}}>
      {cards.slice(0,3).map(card=><Pressable key={card.id} accessibilityRole="button" accessibilityLabel={t("place.open_review")+" · "+card.name} onPress={card.detail}
        style={{width:cardWidth,padding:spacing.base,gap:spacing.sm,minHeight:164,justifyContent:"space-between",backgroundColor:colors.surface.subtle,borderRadius:radius.lg}}>
        <View style={{flexDirection:"row",alignItems:"center",gap:spacing.sm}}>
          <SpawterAvatar url={card.avatar}/><View style={{flex:1}}>
            <Text numberOfLines={1} style={{...preset.h3,color:colors.text.primary}}>{card.name}</Text>
            {card.title ? <Text style={{...preset.caption,color:colors.text.secondary}}>{card.title}</Text> : null}
          </View><Text style={{...preset.h3,color:colors.chat.djidji}}>★ {card.score.toLocaleString("fr-FR",{maximumFractionDigits:1})}/5</Text>
        </View>
        <View style={{flexDirection:"row",alignItems:"center",gap:spacing.sm}}>
          {card.text ? <Text numberOfLines={3} style={{flex:1,...preset.body,color:colors.text.primary}}>{card.text}</Text> : null}
          {card.photo ? <Image accessible={false} source={card.photo} resizeMode="cover" style={{width:58,height:58,borderRadius:radius.md}}/>:null}
          <Ico name="chevron-right" size={16} color={colors.brand.accent}/>
        </View>
      </Pressable>)}
    </ScrollView>
    {onSeeAll ? <Pressable accessibilityRole="button" onPress={onSeeAll} style={{minHeight:44,justifyContent:"center"}}><Text style={{...preset.small,color:colors.brand.accent}}>{t("place.more_opinions")} →</Text></Pressable> : null}
    {opened ? <Modal transparent animationType="slide" onRequestClose={()=>setOpened(null)}>
      <View style={{flex:1,justifyContent:"flex-end",backgroundColor:colors.overlay.modal}}>
        <View accessibilityViewIsModal style={{backgroundColor:colors.surface.base,padding:spacing.lg,maxHeight:"85%",borderTopLeftRadius:radius.lg,borderTopRightRadius:radius.lg}}>
          <Pressable accessibilityRole="button" onPress={()=>setOpened(null)} style={{minHeight:44,alignItems:"flex-end",justifyContent:"center"}}><Text style={{...preset.body,color:colors.brand.accent}}>{t("common.close")}</Text></Pressable>
          <ScrollView><ReviewCard key={opened.id} review={opened} theme={theme} expandedInitially/></ScrollView>
        </View>
      </View>
    </Modal> : null}
  </View>;
}
