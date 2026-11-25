import { useEffect, useState } from "react";
import { AppState, Modal, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useSpawterStore } from "../store/spawter-store";
import { isSupabaseConfigured } from "../lib/data-source";
import { brunchPlace, dismissPilot, getPilotPresentation, recordColdOpen, recordWarmOpen, subscribePilot, syncPilot } from "../lib/pilot-journey";

export function PilotReturn() {
  const owner=useSpawterStore(s=>s.spawter?.id ?? null);
  const hydrating=useSpawterStore(s=>s.hydrating);
  const [card,setCard]=useState<{owner:string;offer:boolean;notice:boolean} | null>(null);
  const router=useRouter();
  const {t}=useTranslation();
  const theme=useTheme();
  useEffect(()=>{
    if (!isSupabaseConfigured || Platform.OS !== "android") return;
    void recordColdOpen().catch(()=>undefined);
    if (hydrating) return;
    let alive=true;
    const read=()=>{ if (owner) void getPilotPresentation(owner).then(s=>{
      if(alive)setCard({owner,offer:!!s.offer,notice:s.notice});
    }).catch(()=>undefined); };
    const refresh=()=>{ void syncPilot(owner).then(read).catch(read); };
    read(); refresh();
    const unsubscribe=subscribePilot(read);
    let prior=AppState.currentState;
    const app=AppState.addEventListener("change",next=>{
      if(next==="active" && prior==="background") void recordWarmOpen().then(refresh).catch(()=>undefined);
      prior=next;
    });
    const net=NetInfo.addEventListener(s=>{if(s.isConnected)refresh();});
    const timer=setInterval(()=>{if(AppState.currentState==="active")refresh();},30_000);
    return ()=>{alive=false;unsubscribe();app.remove();net();clearInterval(timer);};
  },[owner,hydrating]);
  if(!owner || card?.owner!==owner || (!card.offer && !card.notice))return null;
  const act=async(open:boolean)=>{
    await dismissPilot(owner);
    if(open && useSpawterStore.getState().spawter?.id===owner) router.push({pathname:"/place/[id]",params:{id:brunchPlace}});
  };
  return <Modal transparent animationType="fade" visible onRequestClose={()=>void act(false)}>
    <View style={{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,0,0,.45)"}}>
      <View accessibilityViewIsModal style={{backgroundColor:theme.colors.surface.base,padding:24,paddingBottom:36,gap:16}}>
        <Text accessibilityRole="header" style={{...theme.typography.preset.h2,color:theme.colors.text.primary}}>{t(card.offer?"pilot.place_name":"pilot.code_unavailable")}</Text>
        {card.offer && <>
          <Text style={{color:theme.colors.text.primary}}>{t("pilot.brunch_intro")}</Text>
          <Pressable accessibilityRole="button" testID="pilot-open-place" onPress={()=>void act(true)} style={{padding:16,backgroundColor:theme.colors.brand.primary,borderRadius:12}}>
            <Text style={{color:theme.colors.text.onBrand}}>{t("pilot.open_place")}</Text>
          </Pressable>
        </>}
        <Pressable accessibilityRole="button" onPress={()=>void act(false)} style={{padding:12}}>
          <Text style={{color:theme.colors.text.primary}}>{t("pilot.continue")}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
