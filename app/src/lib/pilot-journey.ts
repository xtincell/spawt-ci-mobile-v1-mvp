import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { getConsent } from "./storage";

const storageKey = "spawt:pilot:installation:v1";
export const brunchPlace = "c5acfd12-01dd-5cd3-9beb-0531d89c3e99";
type Open = { id: string; at: string };
type View = Open & { owner: string; place: string };
type Credential = { value: string; owner: string | null };
type Offer = { place: string; journey: string; owner: string };
type Install = {
  install: string;
  first: string;
  installedAt: string | null;
  existing: boolean;
  firstOwner: string | null;
  bound: string[];
  opens: Open[];
  views: View[];
  onboardings?: Record<string, string>;
  pending: Credential | null;
  offer: Offer | null;
  notice: string | null;
};
type RpcResult = { place_id?: string; journey_id?: string; saved?: boolean };

let storageTail: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const processStartedAt = new Date().toISOString();
const queueByOwner = new Map<string, Promise<void>>();

export function subscribePilot(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

async function initial(): Promise<Install> {
  let installedAt: string | null = null;
  let existing = true;
  if (Platform.OS === "android") {
    try {
      const [install, update] = await Promise.all([
        Application.getInstallationTimeAsync(), Application.getLastUpdateTimeAsync(),
      ]);
      installedAt = install.toISOString();
      existing = install.getTime() !== update.getTime();
    } catch { /* Without native evidence this installation remains unattributed. */ }
  }
  return { install: randomUUID(), first: processStartedAt, installedAt, existing, firstOwner: null, bound: [],
    opens: [], views: [], pending: null, offer: null, notice: null };
}

function transaction<T>(edit: (state: Install) => T, notify = false): Promise<T> {
  const operation = storageTail.then(async () => {
    const raw = await AsyncStorage.getItem(storageKey);
    const state: Install = raw ? JSON.parse(raw) : await initial();
    const result = edit(state);
    await AsyncStorage.setItem(storageKey, JSON.stringify(state));
    if (notify) listeners.forEach(fn => fn());
    return result;
  });
  storageTail = operation.catch(() => undefined);
  return operation;
}

export function getPilotPresentation(owner: string) {
  return transaction(s => ({
    offer: s.offer?.owner === owner ? s.offer : null, notice: s.notice === owner,
  }));
}

export function dismissPilot(owner: string) {
  return transaction(s => {
    if (s.offer?.owner === owner) s.offer = null;
    if (s.notice === owner) s.notice = null;
  }, true);
}

export function validateCredential(raw: string): string | null {
  const value = raw.trim();
  if (/^[0-9a-f]{12}$/i.test(value)) return value.toUpperCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

export async function savePilotCredential(raw: string, owner: string | null) {
  const value = validateCredential(raw);
  if (!value) throw new Error("invalid_code");
  await transaction(s => {
    if (s.pending?.value !== value) s.pending = { value, owner };
    s.notice = null;
  }, true);
}

let coldRecorded: Promise<void> | undefined;
export function recordColdOpen() {
  coldRecorded ??= transaction(s => {
    // The OS clock can change. The first observed process timestamp stays immutable.
    s.opens.push({ id: randomUUID(), at: processStartedAt < s.first ? s.first : processStartedAt });
  }).catch(error => { coldRecorded = undefined; throw error; });
  return coldRecorded;
}

export function recordWarmOpen() {
  return transaction(s => {
    s.opens.push({ id: randomUUID(), at: new Date(Math.max(Date.now(), Date.parse(s.first))).toISOString() });
  });
}

async function rpc(name: string, params: Record<string, unknown>, owner?: string) {
  const { supabase } = await import("./supabase");
  const query = supabase.rpc(name, params);
  if (owner) {
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== owner) throw new Error("pilot_session_changed");
    query.setHeader("Authorization", "Bearer " + data.session.access_token);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as RpcResult | null;
}

async function sendOpens() {
  if (!(await getConsent("cgv"))) return null;
  await recordColdOpen();
  const s = await transaction(state => state);
  for (const event of s.opens) {
    await rpc("pilot_app_open", {
      p_install_key: s.install, p_event_key: event.id, p_first_open_at: s.first,
      p_opened_at: event.at, p_installed_at: s.installedAt, p_existing_install: s.existing,
    });
    await transaction(fresh => { fresh.opens = fresh.opens.filter(x => x.id !== event.id); });
  }
  return s.install;
}

async function bind(install: string, owner: string) {
  if (await transaction(s => s.bound.includes(owner))) return;
  await rpc("pilot_bind_install", { p_install_key: install }, owner);
  await transaction(s => { if (!s.bound.includes(owner)) s.bound.push(owner); });
}

async function sendPending(owner: string | null) {
  // Capture account ownership offline, before a later account can claim the handoff.
  if (owner) {
    await transaction(s => {
      s.firstOwner ??= owner;
      if (s.pending && s.pending.owner === null) s.pending.owner = owner;
      if (s.pending?.owner === owner && s.firstOwner !== owner) {
        s.pending = null;
        s.notice = owner;
      }
    });
  }
  const install = await sendOpens();
  if (!install || !owner) return;
  const s = await transaction(state => state);
  const views = s.views.filter(view => view.owner === owner);
  await bind(install, owner);
  if (s.pending?.owner === owner) {
    const credential = s.pending.value;
    try {
      const claim = await rpc("pilot_claim", { p_install_key: install, p_credential: credential }, owner);
      await transaction(fresh => {
        if (fresh.pending?.value !== credential || fresh.pending.owner !== owner) return;
        fresh.pending = null;
        if (claim?.place_id === brunchPlace && claim.journey_id) {
          fresh.offer = { owner, place: claim.place_id, journey: claim.journey_id };
        }
      }, true);
    } catch (error) {
      if ((error as { message?: string })?.message !== "claim_unavailable") throw error;
      await transaction(fresh => {
        if (fresh.pending?.value === credential && fresh.pending.owner === owner) {
          fresh.pending = null;
          fresh.notice = owner;
        }
      }, true);
    }
  }
  const completedAt = s.onboardings?.[owner];
  if (completedAt) {
    // A temporarily missing server-side Palais must not stop other pilot events.
    try {
      await rpc("pilot_onboarding_received", {
        p_install_key: install, p_completed_at: completedAt,
      }, owner);
      await transaction(fresh => {
        if (fresh.onboardings?.[owner] === completedAt) delete fresh.onboardings[owner];
      });
    } catch { /* Retain this account-bound receipt for the next sync. */ }
  }
  for (const view of views) {
    await rpc("pilot_place_view", {
      p_install_key: install, p_event_key: view.id, p_place_id: view.place, p_occurred_at: view.at,
    }, owner);
    await transaction(fresh => { fresh.views = fresh.views.filter(x => x.id !== view.id); });
  }
}

export function syncPilot(owner: string | null) {
  const bucket = owner ?? "";
  const run = (queueByOwner.get(bucket) ?? Promise.resolve()).catch(() => undefined)
    .then(() => sendPending(owner));
  queueByOwner.set(bucket, run);
  return run.finally(() => { if (queueByOwner.get(bucket) === run) queueByOwner.delete(bucket); });
}

export async function recordPilotView(owner: string, place: string) {
  const view = { id: randomUUID(), at: new Date().toISOString(), owner, place };
  await transaction(s => { s.views.push(view); });
  await syncPilot(owner);
}

export async function mutatePilotSaved(owner: string, place: string, revision: string, at: string, saved: boolean) {
  const install = await sendOpens();
  if (!install) throw new Error("pilot_consent_pending");
  await bind(install, owner);
  const reply = await rpc("pilot_saved_place", {
    p_install_key: install, p_event_key: revision, p_place_id: place, p_occurred_at: at, p_saved: saved,
  }, owner);
  if (typeof reply?.saved !== "boolean") throw new Error("pilot_saved_unconfirmed");
  return reply.saved;
}

export function queuePilotOnboarding(owner: string) {
  return transaction(s => {
    s.onboardings ??= {};
    s.onboardings[owner] ??= new Date(Math.max(Date.now(),Date.parse(s.first))).toISOString();
  });
}
