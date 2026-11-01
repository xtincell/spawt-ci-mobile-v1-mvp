import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router } from "expo-router";
import { withReadTimeout } from "../data-read-error";
import { supabase } from "../supabase";
import { dataSourceMode } from "../data-source";
import { useSpawterStore } from "../../store/spawter-store";
import { useGuetActive } from "../../store/guet-active";
import { useFeatureFlagsStore } from "../../store/feature-flags";
import { localOutings } from "../outings";
import { armGuet, disarmGuet, isGuetArmed } from "./geofence";
import { registerGeofenceCallback, setPlaceNameLookup } from "./guet-task";
import { cancelAllGuetNotifications, registerNotificationResponseHandler, type GuetPromptPayload } from "./guet-notifications";
import { ensureNotifPermissionPostOTP } from "./guet-permissions";
import { GUET_CONTEXT_KEY, clearGuetContext, handleNearbyEvent, serialGuet, type GuetContext, type NearbyPlace } from "./guet-nearby";

const OPTOUT = "spawt:guet:optout";
let generation = 0; let owner: string | null = null; let lastArmAt = 0;
let listener: { remove: () => void } | null = null; let stopResponses: (() => void) | null = null;
let stopFlags: (() => void) | null = null;
let stopAccount: (() => void) | null = null;
let refreshingFlags = false;

function isCurrent(epoch: number, id: string): boolean {
  return epoch === generation && owner === id && useSpawterStore.getState().spawter?.id === id;
}
function isEnabledFor(id: string): boolean {
  const flags = useFeatureFlagsStore.getState();
  return flags.spawterId === id && Boolean(flags.flags["guet-proximity-v2"]);
}

export async function bootGuet(): Promise<void> {
  const current = useSpawterStore.getState().spawter;
  if (!current || Platform.OS === "web" || dataSourceMode !== "supabase") { await shutdownGuet(); return; }
  if (owner === current.id) return;
  // Claim this boot before awaiting native cleanup. A logout or another boot
  // invalidates it immediately, including when the previous arm is still pending.
  const stopping = shutdownGuet(); const epoch = generation; owner = current.id;
  await stopping;
  if (!isCurrent(epoch, current.id)) return;
  stopResponses = registerNotificationResponseHandler(handleNotifResponse);
  listener = AppState.addEventListener("change", state => { if (state === "active") void rearmGuet({ force: false }).catch(() => undefined); });
  stopFlags = useFeatureFlagsStore.subscribe((next, previous) => {
    if (refreshingFlags) return; // The running rearm checks its own hydrate result.
    if (next.spawterId !== previous.spawterId || next.flags["guet-proximity-v2"] !== previous.flags["guet-proximity-v2"]) {
      void rearmGuet({ force: false }).catch(() => undefined);
    }
  });
  stopAccount = useSpawterStore.subscribe((next, previous) => {
    if (next.spawter?.id !== current.id) { void shutdownGuet().catch(() => undefined); return; }
    if (next.spawter.geoloc_consent_at !== previous.spawter?.geoloc_consent_at) {
      void rearmGuet({ force: false }).catch(() => undefined);
    }
  });
  // Discard old pending rows: a geofence was never a verified visit.
  await AsyncStorage.removeItem("spawt:guet:pending");
  if (!isCurrent(epoch, current.id)) return;
  registerGeofenceCallback((type, place) => handleNearbyEvent(type, place.id));
  await rearmGuet({ force: true });
}
export function shutdownGuet(): Promise<void> {
  generation++; owner = null; lastArmAt = 0;
  listener?.remove(); listener = null; stopResponses?.(); stopResponses = null;
  stopFlags?.(); stopFlags = null; stopAccount?.(); stopAccount = null;
  registerGeofenceCallback(null); setPlaceNameLookup(() => null);
  useGuetActive.getState().exit();
  const cleared = clearGuetContext().catch(() => undefined);
  // Do not wait for a pending GPS fix or permission prompt to revoke native work.
  // geofence's generation also invalidates any arm still awaiting permission.
  const disarmed = disarmGuet().catch(() => undefined);
  const cancelled = cancelAllGuetNotifications().catch(() => undefined);
  // Queue teardown synchronously so a later account boot cannot overtake it.
  return serialGuet(async () => { await cleared; await disarmed; await cancelled; await pauseGuet(); });
}
async function pauseGuet(): Promise<void> {
  lastArmAt = 0;
  setPlaceNameLookup(() => null); useGuetActive.getState().exit();
  // A storage failure must not skip native cancellation.
  await clearGuetContext().catch(() => undefined);
  await disarmGuet(); await cancelAllGuetNotifications().catch(() => undefined);
}
export function rearmGuet(options: { force: boolean }): Promise<void> {
  const epoch = generation; const id = owner;
  return serialGuet(async () => {
    if (!id || !isCurrent(epoch, id)) return;
    try { await rearmUnlocked(options, epoch, id); }
    catch (error) { await pauseGuet(); throw error; }
  });
}
async function rearmUnlocked({ force }: { force: boolean }, epoch: number, id: string): Promise<void> {
  const canContinue = () => isCurrent(epoch, id) && Boolean(useSpawterStore.getState().spawter?.geoloc_consent_at) && isEnabledFor(id);
  if (!useSpawterStore.getState().spawter?.geoloc_consent_at || await isGuetOptedOut()) { await pauseGuet(); return; }
  if (!isCurrent(epoch, id)) { await pauseGuet(); return; }
  // An already-disabled flag must not wait for another network read to stop.
  if (!isEnabledFor(id)) await pauseGuet();
  if (!isCurrent(epoch, id)) return;
  refreshingFlags = true;
  try { await useFeatureFlagsStore.getState().hydrate(id); }
  finally { refreshingFlags = false; }
  if (!canContinue()) { await pauseGuet(); return; }
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || session.session?.user.id !== id || !canContinue()) { await pauseGuet(); return; }
  if (await ensureNotifPermissionPostOTP(true) !== "granted" || !canContinue()) { await pauseGuet(); return; }
  let fg = await Location.getForegroundPermissionsAsync();
  if (!canContinue()) { await pauseGuet(); return; }
  if (fg.status !== "granted" && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted" || !canContinue()) { await pauseGuet(); return; }
  const bg = await Location.getBackgroundPermissionsAsync();
  if ((bg.status !== "granted" && !bg.canAskAgain) || !canContinue()) { await pauseGuet(); return; }
  const armed = await isGuetArmed();
  if (!canContinue()) { await pauseGuet(); return; }
  // Throttle catalogue/position work only. Revocations must take effect on the
  // next flag refresh or foreground, even just after a successful arm.
  if (!force && bg.status === "granted" && armed && lastArmAt > 0 && Date.now() - lastArmAt < 5 * 60_000) return;
  const { data, error } = await withReadTimeout("guet_places", signal => supabase.from("public_guet_places").select("id,name,lat,lng").abortSignal(signal));
  if (error || !canContinue()) { await pauseGuet(); return; }
  let fix = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 100 });
  if (!canContinue()) { await pauseGuet(); return; }
  if (!fix) fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  if (!fix || !canContinue()) { await pauseGuet(); return; }
  const saved = await localOutings(id);
  if (!canContinue()) { await pauseGuet(); return; }
  const state = useSpawterStore.getState();
  const places: NearbyPlace[] = (data ?? []).map(p => ({ ...p,
    saved: state.savedPlaceIds.has(p.id) || saved.snapshot.dishes.some(d => d.place_id === p.id),
    visited: state.spawts.some(s => s.spawter_id === id && s.place_id === p.id && !s.is_seed && !s.is_cancelled && s.check_in_type !== "passive" && s.checked_in_at !== null),
  }));
  const context: GuetContext = { owner: id, expiresAt: Date.now() + 86400_000, places };
  await AsyncStorage.setItem(GUET_CONTEXT_KEY, JSON.stringify(context));
  if (!canContinue()) { await pauseGuet(); return; }
  setPlaceNameLookup(id => places.find(p => p.id === id)?.name ?? null);
  await armGuet(places, { hasGeolocConsent: true, spawter: { lat: fix.coords.latitude, lng: fix.coords.longitude } });
  if (!canContinue() || !(await isGuetArmed())) { await pauseGuet(); return; }
  if (!canContinue()) { await pauseGuet(); return; }
  lastArmAt = Date.now();
}
export const handleGeofenceEvent = (type: "enter" | "exit", place: { id: string; name: string }): Promise<void> => handleNearbyEvent(type, place.id);
export async function handleNotifResponse(_action: "confirm" | "snooze" | "default", payload: GuetPromptPayload): Promise<void> {
  const current = useSpawterStore.getState().spawter;
  if (!current || payload.owner_id !== current.id) return;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== current.id || useSpawterStore.getState().spawter?.id !== current.id) return;
  if (payload.kind === "review") {
    const { data: visit, error } = await withReadTimeout("guet_review_open", signal => supabase.from("spawt_checkin")
      .select("id").eq("id", payload.row_id).eq("spawter_id", current.id).eq("place_id", payload.place_id)
      .eq("is_cancelled", false).eq("is_seed", false).is("deleted_at", null).is("note_etoiles", null)
      .not("checked_in_at", "is", null).neq("check_in_type", "passive").abortSignal(signal).maybeSingle());
    if (error || !visit || useSpawterStore.getState().spawter?.id !== current.id) return;
    router.push({ pathname: "/review/[spawt_id]", params: { spawt_id: visit.id, place_name: payload.place_name } } as never);
    return;
  }
  // Opening a reminder only opens content. The explicit visit flow owns reviews.
  router.push({ pathname: "/place/[id]", params: { id: payload.place_id, tab: "menu" } } as never);
}
export async function finalizeStalePending(): Promise<void> { await AsyncStorage.removeItem("spawt:guet:pending"); }
export async function isGuetOptedOut(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(OPTOUT)) === "1"; } catch { return true; }
}
export async function setGuetOptOut(value: boolean): Promise<void> {
  if (value) { await AsyncStorage.setItem(OPTOUT, "1"); await shutdownGuet(); }
  else { await AsyncStorage.removeItem(OPTOUT); await shutdownGuet(); await bootGuet(); }
}
export function _resetOrchestratorForTest(): void {
  generation++; owner = null; lastArmAt = 0;
  listener?.remove(); listener = null; stopResponses?.(); stopResponses = null;
  stopFlags?.(); stopFlags = null; stopAccount?.(); stopAccount = null;
}
