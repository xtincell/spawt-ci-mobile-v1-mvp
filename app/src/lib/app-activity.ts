import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { inspect } from "./offline-queue";
import { getPushRegistrationStatus, registerPushToken } from "./push-token";
import { withReadTimeout } from "./data-read-error";

const INSTALLATION_KEY = "spawt:installation-id";
export async function startAppActivity(spawterId: string): Promise<() => void> {
  const { supabase } = await import("./supabase");
  let installationId = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (!installationId) {
    installationId = Crypto.randomUUID();
    await AsyncStorage.setItem(INSTALLATION_KEY, installationId);
  }
  let stopped = false;
  let busy = false;
  const report = async (active: boolean) => {
    if (busy) return;
    busy = true;
    try {
      const queue = await inspect();
      const ownPending = queue.filter(entry => entry.kind === "spawter_upsert" ? entry.row.id === spawterId : entry.kind === "spawt_insert" ? entry.row.spawter_id === spawterId : entry.patch.spawter_id === spawterId).length;
      const { error } = await withReadTimeout("app_activity", signal => supabase.rpc("report_app_activity", {
        p_spawter_id: spawterId, p_installation_id: installationId,
        p_active: active, p_platform: Platform.OS,
        p_version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null,
        p_build: Application.nativeBuildVersion ?? null,
        p_push_status: getPushRegistrationStatus(),
        p_pending_writes: ownPending,
      }).abortSignal(signal));
      if (error) throw error;
    } catch { /* Reporting never blocks reading, reviews or logout. */ }
    finally { busy = false; }
  };
  if (AppState.currentState === "active") void report(true);
  const timer = setInterval(() => {
    if (!stopped && AppState.currentState === "active") {
      if (getPushRegistrationStatus() === "registration_failed") void registerPushToken();
      void report(true);
    }
  }, 60_000);
  const sub = AppState.addEventListener("change", state => { void report(state === "active"); });
  return () => { stopped = true; clearInterval(timer); sub.remove(); void report(false); };
}
