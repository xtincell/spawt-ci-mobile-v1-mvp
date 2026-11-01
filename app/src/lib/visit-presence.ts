import * as Location from "expo-location";
import { supabase } from "./supabase";
import { withReadTimeout } from "./data-read-error";
import type { SpawtCheckin } from "../types/spawt";
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

/** Relit la preuve serveur; le booléen du RPC ne fabrique aucun spawt local. */
export async function readVerifiedVisit(id: string, owner: string): Promise<SpawtCheckin | null> {
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || session.session?.user.id !== owner) return null;
  const { data, error } = await withReadTimeout("verified_visit", signal => supabase.from("spawt_checkin")
    .select("*").eq("id", id).eq("spawter_id", owner).eq("is_verified", true)
    .eq("is_seed", false).eq("is_cancelled", false).is("deleted_at", null)
    .not("checked_in_at", "is", null).neq("check_in_type", "passive").abortSignal(signal).maybeSingle<SpawtCheckin>());
  if (error || !data || data.id !== id || data.spawter_id !== owner) return null;
  const { data: current } = await supabase.auth.getSession();
  return current.session?.user.id === owner ? data : null;
}
