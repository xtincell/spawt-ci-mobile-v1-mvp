import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSpawterStore } from "../../src/store/spawter-store";
import { savePilotCredential, syncPilot, validateCredential } from "../../src/lib/pilot-journey";

export default function ResumeByLink() {
  const {token}=useLocalSearchParams<{token:string}>();
  const router=useRouter();
  const hydrating=useSpawterStore(s=>s.hydrating);
  useEffect(()=>{
    if(typeof token!=="string" || !validateCredential(token)){router.replace("/reprendre");return;}
    let active=true;
    const owner=useSpawterStore.getState().spawter?.id??null;
    // Durability comes before any redirection through consent or onboarding.
    void savePilotCredential(token,owner).then(()=>{
      if(!active || hydrating)return;
      void syncPilot(owner).catch(()=>undefined);
      router.replace(owner?"/(tabs)":"/");
    }).catch(()=>{if(active)router.replace("/reprendre");});
    return ()=>{active=false;};
  },[token,hydrating,router]);
  return null;
}
