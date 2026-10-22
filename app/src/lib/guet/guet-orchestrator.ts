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
export async function bootGuet(): Promise<void> {
  const current = useSpawterStore.getState().spawter;
  if (!current || Platform.OS === "web" || dataSourceMode !== "supabase") return;
  if (owner === current.id) return;
  await shutdownGuet(); if (useSpawterStore.getState().spawter?.id !== current.id) return; const epoch = ++generation; owner = current.id;
  stopResponses = registerNotificationResponseHandler(handleNotifResponse);
  listener = AppState.addEventListener("change", state => { if (state === "active") void rearmGuet({ force: false }).catch(() => undefined); });
  if (await isGuetOptedOut() || !current.geoloc_consent_at || epoch !== generation) return;
  await useFeatureFlagsStore.getState().hydrate(current.id);
  if (epoch !== generation || !useFeatureFlagsStore.getState().flags["guet-proximity-v2"]) return;
  if (await ensureNotifPermissionPostOTP(true) !== "granted" || epoch !== generation) return;
  // Discard old pending rows: a geofence was never a verified visit.
  await AsyncStorage.removeItem("spawt:guet:pending");
  registerGeofenceCallback((type, place) => handleNearbyEvent(type, place.id));
  await rearmGuet({ force: true });
  if (epoch !== generation) return;
}
export async function shutdownGuet(): Promise<void> {
  generation++; owner = null; lastArmAt = 0;
  listener?.remove(); listener = null; stopResponses?.(); stopResponses = null;
  registerGeofenceCallback(null); setPlaceNameLookup(() => null);
  useGuetActive.getState().exit();
  await clearGuetContext();
  await serialGuet(async () => { await disarmGuet(); await cancelAllGuetNotifications().catch(() => undefined); });
}
async function pauseGuet(): Promise<void> {
  await clearGuetContext(); await disarmGuet(); await cancelAllGuetNotifications().catch(() => undefined);
}
export function rearmGuet(options: { force: boolean }): Promise<void> {
  return serialGuet(async () => { try { await rearmUnlocked(options); } catch (error) { await pauseGuet(); throw error; } });
}
async function rearmUnlocked({ force }: { force: boolean }): Promise<void> {
  const epoch = generation; const current = useSpawterStore.getState().spawter;
  if (!current || !current.geoloc_consent_at || await isGuetOptedOut()) { await pauseGuet(); return; }
  if (!force && Date.now() - lastArmAt < 5 * 60_000) return;
  await useFeatureFlagsStore.getState().hydrate(current.id);
  if (epoch !== generation) return;
  if (!useFeatureFlagsStore.getState().flags["guet-proximity-v2"]) { await pauseGuet(); return; }
  if (await ensureNotifPermissionPostOTP(true) !== "granted" || epoch !== generation) { await pauseGuet(); return; }
  const { data, error } = await withReadTimeout("guet_places", signal => supabase.from("public_guet_places").select("id,name,lat,lng").abortSignal(signal));
  if (error) { await pauseGuet(); return; }
  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted" && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") { await pauseGuet(); return; }
  let fix = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 100 });
  if (!fix) fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  if (!fix || epoch !== generation || useSpawterStore.getState().spawter?.id !== current.id) return;
  const state = useSpawterStore.getState(); const saved = await localOutings(current.id);
  const places: NearbyPlace[] = (data ?? []).map(p => ({ ...p,
    saved: state.savedPlaceIds.has(p.id) || saved.snapshot.dishes.some(d => d.place_id === p.id),
    visited: state.spawts.some(s => s.spawter_id === current.id && s.place_id === p.id && !s.is_seed && !s.is_cancelled && s.check_in_type !== "passive" && s.checked_in_at !== null),
  }));
  if (epoch !== generation) return;
  const context: GuetContext = { owner: current.id, expiresAt: Date.now() + 86400_000, places };
  await AsyncStorage.setItem(GUET_CONTEXT_KEY, JSON.stringify(context));
  if (epoch !== generation) { await clearGuetContext(); return; }
  setPlaceNameLookup(id => places.find(p => p.id === id)?.name ?? null);
  await armGuet(places, { hasGeolocConsent: true, spawter: { lat: fix.coords.latitude, lng: fix.coords.longitude } });
  if (epoch !== generation) { await disarmGuet(); await clearGuetContext(); return; }
  if (!(await isGuetArmed())) { await clearGuetContext(); return; }
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
export function _resetOrchestratorForTest(): void { generation++; owner = null; lastArmAt = 0; listener?.remove(); listener = null; stopResponses?.(); stopResponses = null; }
