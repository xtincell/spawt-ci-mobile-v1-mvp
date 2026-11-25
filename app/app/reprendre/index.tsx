import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useSpawterStore } from "../../src/store/spawter-store";
import { savePilotCredential, syncPilot, validateCredential } from "../../src/lib/pilot-journey";

export default function ResumeByCode() {
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const spawter=useSpawterStore(s=>s.spawter);
  const theme=useTheme(), insets=useSafeAreaInsets(), router=useRouter(), {t}=useTranslation();
  const submit=async()=>{
    if(!validateCredential(code)){Alert.alert(t("pilot.code_invalid"));return;}
    setBusy(true);
    try{
      await savePilotCredential(code,spawter?.id??null);
      void syncPilot(spawter?.id??null).catch(()=>undefined);
      router.replace(spawter?"/(tabs)":"/");
    } catch { Alert.alert(t("common.error_generic")); } finally {setBusy(false);}
  };
  return <View style={{flex:1,padding:24,paddingTop:insets.top+28,gap:16,backgroundColor:theme.colors.surface.base}}>
    <Text accessibilityRole="header" style={{...theme.typography.preset.h2,color:theme.colors.text.primary}}>{t("pilot.title")}</Text>
    <Text style={{color:theme.colors.text.primary}}>{t("pilot.code_help")}</Text>
    <TextInput value={code} onChangeText={setCode} accessibilityLabel={t("pilot.code_label")} placeholder="A1B2C3D4E5F6"
      autoCapitalize="characters" autoCorrect={false} maxLength={12} testID="pilot-code-input"
      style={{padding:12,borderWidth:1,borderColor:theme.colors.text.primary,color:theme.colors.text.primary,borderRadius:8}}/>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void submit()} testID="pilot-code-submit" style={{padding:16,backgroundColor:theme.colors.brand.primary,borderRadius:12}}>
      <Text style={{color:theme.colors.text.onBrand}}>{t("pilot.resume")}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={()=>router.replace(spawter?"/(tabs)":"/")} style={{padding:12}}>
      <Text style={{color:theme.colors.text.primary}}>{t("pilot.continue")}</Text>
    </Pressable>
  </View>;
}
