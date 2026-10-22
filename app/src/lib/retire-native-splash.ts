import { requireOptionalNativeModule } from "expo";
import * as SplashScreen from "expo-splash-screen";
import { Platform } from "react-native";

interface OpeningBridge { prepareAsync(): Promise<void>; waitAsync(): Promise<void> }

/** hideAsync ne confirme pas que la fenêtre Android a effectivement disparu. */
export async function retireNativeSplash(): Promise<void> {
  const bridge = Platform.OS === "android"
    ? requireOptionalNativeModule<OpeningBridge>("SpawtOpening") : null;
  let prepared = false;
  if (bridge) {
    try { await bridge.prepareAsync(); prepared = true; }
    catch { /* Expo Go et activités interrompues gardent le relais standard. */ }
  }
  await SplashScreen.hideAsync();
  if (prepared && bridge) {
    try { await bridge.waitAsync(); }
    catch { /* Une erreur du relais natif ne doit pas bloquer l'accès. */ }
  }
}
