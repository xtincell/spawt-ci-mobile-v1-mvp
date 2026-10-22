import * as Location from "expo-location";
import { supabase } from "./supabase";
import { withReadTimeout } from "./data-read-error";
/** Only invoked after the explicit visit has reached the server. Never prompts. */
export async function verifyVisitPresence(id: string, owner: string): Promise<boolean> {
  try {
    if ((await Location.getForegroundPermissionsAsync()).status !== "granted") return false;
    const fix = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 50 });
    if (!fix || fix.coords.accuracy == null || Date.now() - fix.timestamp > 120_000) return false;
    const { data, error } = await withReadTimeout("visit_presence", signal => supabase.rpc("verify_visit_presence", {
      p_spawt_id: id, p_owner: owner, p_lat: fix.coords.latitude, p_lng: fix.coords.longitude,
      p_accuracy: fix.coords.accuracy, p_measured_at: new Date(fix.timestamp).toISOString(),
    }).abortSignal(signal));
    return !error && data === true;
  } catch { return false; }
}
