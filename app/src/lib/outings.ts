import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { dataSourceMode } from "./data-source";
import { withReadTimeout } from "./data-read-error";

export type Occasion = "date" | "anniversaire" | "vendredi" | "brunch" | "autre";
export type OutingTarget = { place_id: string; menu_item_id?: never } | { menu_item_id: string; place_id?: never };
export interface MenuItem {
  id: string; place_id: string; name: string; place_name: string; price_xof: number | null;
  observed_on: string; photo_url: string | null; is_published: boolean;
  aliases?: string[]; accompaniments?: string[]; description?: string; source_url?: string;
  neighborhood?: string; place_photo_url?: string | null;
}
export interface PersonalList { id: string; title: string; occasion: Occasion | null; share_token: string | null; }
export interface PersonalListItem { id: string; list_id: string; place_id: string | null; menu_item_id: string | null; }
export interface OutingsSnapshot {
  lists: PersonalList[]; items: PersonalListItem[]; dishes: MenuItem[];
  choices: { place_id: string; chosen_at: string }[]; dismissed: string[];
}
export const emptyOutings = (): OutingsSnapshot => ({ lists: [], items: [], dishes: [], choices: [], dismissed: [] });
export type OutingAction = "save" | "unsave" | "list_create" | "list_rename" | "list_delete" | "list_add" | "list_remove" | "list_share" | "choose" | "dismiss" | "restore";
export interface OutingMutation { id: string; action: OutingAction; payload: Record<string, unknown>; dish?: MenuItem; failed?: boolean; }
interface Document { owner: string; snapshot: OutingsSnapshot; pending: OutingMutation[]; }
const key = (owner: string) => `spawt:outings:v1:${owner}`;
let tail: Promise<unknown> = Promise.resolve();
const locked = <T,>(fn: () => Promise<T>): Promise<T> => {
  const result = tail.then(fn); tail = result.catch(() => undefined); return result;
};
export function applyOuting(state: OutingsSnapshot, mutation: OutingMutation): OutingsSnapshot {
  const s: OutingsSnapshot = JSON.parse(JSON.stringify(state));
  const { action, payload: p, dish } = mutation;
  const matches = (i: PersonalListItem) => i.list_id === p.list_id && (p.place_id ? i.place_id === p.place_id : i.menu_item_id === p.menu_item_id);
  if ((action === "save" || action === "list_add") && dish && !s.dishes.some(d => d.id === dish.id)) s.dishes.unshift(dish);
  if (action === "unsave") { s.dishes = s.dishes.filter(d => d.id !== p.menu_item_id); s.items = s.items.filter(i => !(p.place_id ? i.place_id === p.place_id : i.menu_item_id === p.menu_item_id)); }
  if (action === "list_create") s.lists.unshift({ id: String(p.list_id), title: String(p.title), occasion: p.occasion as Occasion | null, share_token: null });
  if (action === "list_rename") s.lists = s.lists.map(l => l.id === p.list_id ? { ...l, title: String(p.title), occasion: p.occasion as Occasion | null } : l);
  if (action === "list_delete") { s.lists = s.lists.filter(l => l.id !== p.list_id); s.items = s.items.filter(i => i.list_id !== p.list_id); }
  if (action === "list_add" && !s.items.some(matches)) s.items.push({ id: mutation.id, list_id: String(p.list_id), place_id: p.place_id as string ?? null, menu_item_id: p.menu_item_id as string ?? null });
  if (action === "list_remove") s.items = s.items.filter(i => !matches(i));
  if (action === "choose") s.choices = [...s.choices.filter(c => c.place_id !== p.place_id), { place_id: String(p.place_id), chosen_at: new Date().toISOString() }];
  if (action === "dismiss" && !s.dismissed.includes(String(p.place_id))) s.dismissed.push(String(p.place_id));
  if (action === "restore") s.dismissed = s.dismissed.filter(id => id !== p.place_id);
  return s;
}
async function read(owner: string): Promise<Document> {
  const raw = await AsyncStorage.getItem(key(owner));
  if (!raw) return { owner, snapshot: emptyOutings(), pending: [] };
  const doc = JSON.parse(raw) as Document;
  if (doc.owner !== owner || !Array.isArray(doc.pending) || !Array.isArray(doc.snapshot?.lists)) throw new Error("outings_cache_invalid");
  return doc;
}
export async function localOutings(owner: string): Promise<{ snapshot: OutingsSnapshot; pending: number; rejected: number; pendingPlaces: Record<string, boolean> }> {
  return locked(async () => {
    const doc = await read(owner);
    const pendingPlaces: Record<string, boolean> = {};
    for (const m of doc.pending.filter(p => !p.failed)) {
      if (typeof m.payload.place_id === "string" && ["save", "list_add", "unsave"].includes(m.action)) pendingPlaces[m.payload.place_id] = m.action !== "unsave";
    }
    return { pendingPlaces, snapshot: doc.pending.filter(p => !p.failed).reduce(applyOuting, doc.snapshot), pending: doc.pending.filter(p => !p.failed).length, rejected: doc.pending.filter(p => p.failed).length };
  });
}
export async function enqueueOuting(owner: string, action: OutingAction, payload: Record<string, unknown>, isCurrent: () => boolean, dish?: MenuItem): Promise<void> {
  await locked(async () => {
    if (!isCurrent()) throw new Error("session_changed");
    const doc = await read(owner);
    if (!isCurrent()) throw new Error("session_changed");
    doc.pending.push({ id: Crypto.randomUUID(), action, payload, ...(dish ? { dish } : {}) });
    await AsyncStorage.setItem(key(owner), JSON.stringify(doc));
  });
}
const flights = new Map<string, Promise<void>>();
export async function syncOutings(owner: string, isCurrent: () => boolean): Promise<void> {
  const flight = flights.get(owner);
  if (flight) {
    await flight;
    if (!isCurrent()) return;
    // A save/list action can arrive after this flight drained its queue,
    // while its final snapshot is still loading. Joining that read alone
    // leaves the new action pending until another screen happens to refresh.
    const doc = await locked(() => read(owner));
    if (isCurrent() && doc.pending.some(p => !p.failed)) {
      await syncOutings(owner, isCurrent);
    }
    return;
  }
  const work = (async () => {
    if (dataSourceMode !== "supabase") return;
    while (isCurrent()) {
      const doc = await locked(() => read(owner));
      const mutation = doc.pending.find(p => !p.failed); if (!mutation) break;
      const { data: auth } = await supabase.auth.getSession();
      if (!isCurrent() || auth.session?.user.id !== owner) return;
      const { error } = await withReadTimeout("outing_write", signal => supabase.rpc("mutate_outing", { p_id: mutation.id, p_action: mutation.action, p_payload: mutation.payload, p_owner: owner }).abortSignal(signal));
      if (!isCurrent()) return;
      if (error && !["22023", "42501", "23514", "23505", "23502"].includes(error.code)) throw error;
      await locked(async () => {
        const current = await read(owner);
        if (error) current.pending = current.pending.map(p => p.id === mutation.id ? { ...p, failed: true } : p);
        else { current.snapshot = applyOuting(current.snapshot, mutation); current.pending = current.pending.filter(p => p.id !== mutation.id); }
        await AsyncStorage.setItem(key(owner), JSON.stringify(current));
      });
    }
    if (!isCurrent()) return;
    const { data, error } = await withReadTimeout("outings_read", signal => supabase.rpc("my_outings", { p_owner: owner }).abortSignal(signal));
    if (error) throw error;
    if (!data || !Array.isArray(data.lists) || !Array.isArray(data.dishes)) throw new Error("outings_response_invalid");
    if (!isCurrent()) return;
    await locked(async () => {
      const doc = await read(owner);
      if (!isCurrent()) return;
      doc.snapshot = data as OutingsSnapshot;
      await AsyncStorage.setItem(key(owner), JSON.stringify(doc));
    });
  })().finally(() => flights.delete(owner));
  flights.set(owner, work); return work;
}
export async function discardRejectedOutings(owner: string): Promise<void> {
  await locked(async () => { const doc = await read(owner); doc.pending = doc.pending.filter(p => !p.failed); await AsyncStorage.setItem(key(owner), JSON.stringify(doc)); });
}
export async function listMenuItems(placeId?: string): Promise<MenuItem[]> {
  if (dataSourceMode !== "supabase") return [];
  const items: MenuItem[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("public_menu_items").select("*").order("id").range(offset, offset + 499);
    if (placeId) query = query.eq("place_id", placeId);
    const { data, error } = await withReadTimeout("menu_items", signal => query.abortSignal(signal));
    if (error) throw error;
    items.push(...data as MenuItem[]);
    if (data.length < 500) return items;
  }
}
export const listShareUrl = (token: string): string => `https://spawt.online/liste/${encodeURIComponent(token)}`;
