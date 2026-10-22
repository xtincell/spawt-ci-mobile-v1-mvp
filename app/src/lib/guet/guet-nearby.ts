// Background entrypoint: no React mount, hydrated store, or created visit required.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase } from "../supabase";
import { scheduleGuetPrompt, cancelGuetPrompt } from "./guet-notifications";
import fr from "../../i18n/fr.json";
import { withReadTimeout } from "../data-read-error";

export const GUET_CONTEXT_KEY = "spawt:guet:v2:context";
export const GUET_DELAY_SECONDS = 120;
const DAY = 86400_000;
export interface NearbyPlace { id: string; name: string; lat: number; lng: number; saved: boolean; visited: boolean; occasion?: string; }
export interface GuetContext { owner: string; expiresAt: number; places: NearbyPlace[]; }
interface Stay { id: string; placeId: string; arrivedAt: number; dueAt: number; notification: string | null; }
interface History { id: string; placeId: string; dueAt: number; kind?: "nearby" | "review"; }
interface DeviceState { owner: string; stays: Stay[]; history: History[]; lastFailure: string | null; }
const stateKey = (owner: string) => `spawt:guet:v2:state:${owner}`;
let tail: Promise<unknown> = Promise.resolve();
export function serialGuet<T>(fn: () => Promise<T>): Promise<T> { const next = tail.then(fn); tail = next.catch(() => undefined); return next; }
export async function readGuetContext(): Promise<GuetContext | null> {
  const raw = await AsyncStorage.getItem(GUET_CONTEXT_KEY); if (!raw) return null;
  const context = JSON.parse(raw) as GuetContext;
  if (!context.owner || !Array.isArray(context.places) || !(context.expiresAt > Date.now())) return null;
  const { data, error } = await supabase.auth.getSession();
  return !error && data.session?.user.id === context.owner ? context : null;
}
export function proximityCopy(place: NearbyPlace): string {
  const key = place.visited ? (place.saved ? "saved_visited" : "visited") : (place.saved ? "saved" : "discover");
  return fr.guet_v2[key].replace("{{name}}", place.name);
}
export function mayNotify(history: readonly History[], placeId: string, dueAt: number, kind: "nearby" | "review" = "nearby"): boolean {
  const date = new Date(dueAt); const hour = date.getHours();
  if (hour < 9 || hour >= 22) return false;
  if (history.some(h => h.placeId === placeId && (h.kind ?? "nearby") === kind && dueAt - h.dueAt < 7 * DAY)) return false;
  return history.filter(h => new Date(h.dueAt).toDateString() === date.toDateString()).length < 2;
}
export async function handleNearbyEvent(type: "enter" | "exit", placeId: string, now = Date.now()): Promise<void> {
  await serialGuet(async () => {
    const context = await readGuetContext(); if (!context) return;
    const place = context.places.find(p => p.id === placeId); if (!place) return;
    const raw = await AsyncStorage.getItem(stateKey(context.owner));
    const state: DeviceState = raw ? JSON.parse(raw) : { owner: context.owner, stays: [], history: [], lastFailure: null };
    if (state.owner !== context.owner) return;
    state.history = state.history.filter(h => now - h.dueAt < 7 * DAY);
    state.stays = state.stays.filter(s => now - s.arrivedAt < DAY);
    const stay = state.stays.find(s => s.placeId === placeId);
    if (type === "exit") {
      if (!stay) return;
      if (now < stay.dueAt) {
        await cancelGuetPrompt(stay.id);
        state.history = state.history.filter(h => h.id !== stay.id);
      }
      state.stays = state.stays.filter(s => s.id !== stay.id);
      // Only an explicit, already persisted visit may produce a review reminder.
      const dueAt = now + GUET_DELAY_SECONDS * 1000;
      if (now >= stay.dueAt && mayNotify(state.history, placeId, dueAt, "review")) {
        try {
          const { data, error } = await withReadTimeout("guet_review", signal => supabase.from("spawt_checkin")
            .select("id").eq("spawter_id", context.owner).eq("place_id", placeId).eq("is_seed", false).eq("is_cancelled", false)
            .is("deleted_at", null).is("note_etoiles", null).neq("check_in_type", "passive")
            .gte("checked_in_at", new Date(stay.arrivedAt).toISOString()).lte("checked_in_at", new Date(now).toISOString())
            .order("checked_in_at", { ascending: false }).limit(1).abortSignal(signal));
          const visit = data?.[0];
          if (!error && visit && (await readGuetContext())?.owner === context.owner) {
            const id = await scheduleGuetPrompt({ row_id: visit.id, owner_id: context.owner, place_id: placeId, place_name: place.name,
              kind: "review", body: fr.guet_v2.review.replace("{{name}}", place.name) }, GUET_DELAY_SECONDS);
            if (id) state.history.push({ id: visit.id, placeId, dueAt, kind: "review" });
            else state.lastFailure = "notification_schedule_failed";
          }
        } catch { state.lastFailure = "review_read_failed"; }
      }
    } else {
      if (stay) return;
      const next: Stay = { id: Crypto.randomUUID(), placeId, arrivedAt: now, dueAt: now + GUET_DELAY_SECONDS * 1000, notification: null };
      state.stays.push(next);
      if (mayNotify(state.history, placeId, next.dueAt)) {
        // Recheck the active identity after asynchronous storage/auth work.
        if ((await readGuetContext())?.owner !== context.owner) return;
        next.notification = await scheduleGuetPrompt({ row_id: next.id, owner_id: context.owner, place_id: placeId, place_name: place.name, body: proximityCopy(place), kind: "nearby" }, GUET_DELAY_SECONDS);
        if (next.notification) state.history.push({ id: next.id, placeId, dueAt: next.dueAt });
        else state.lastFailure = "notification_schedule_failed";
      }
    }
    await AsyncStorage.setItem(stateKey(context.owner), JSON.stringify(state));
  });
}
export async function clearGuetContext(): Promise<void> {
  await AsyncStorage.removeItem(GUET_CONTEXT_KEY);
}
