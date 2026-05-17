// Wrapper AsyncStorage — local cache pour le mode fallback (sans Supabase).
// Conserve le spawter, le Palais, les spawts locaux entre les ouvertures de l'app.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import type { SpawtCheckin } from "../types/spawt";

const KEYS = {
  spawter: "spawt:spawter",
  palais: "spawt:palais",
  spawts: "spawt:spawts",
  consent_geoloc: "spawt:consent:geoloc",
  consent_cgv: "spawt:consent:cgv",
} as const;

export async function loadSpawter(): Promise<Spawter | null> {
  return readJSON<Spawter>(KEYS.spawter);
}
export async function saveSpawterLocal(s: Spawter): Promise<void> {
  await writeJSON(KEYS.spawter, s);
}

export async function loadPalais(): Promise<UserPalais | null> {
  return readJSON<UserPalais>(KEYS.palais);
}
export async function savePalaisLocal(p: UserPalais): Promise<void> {
  await writeJSON(KEYS.palais, p);
}

export async function loadSpawts(): Promise<SpawtCheckin[]> {
  return (await readJSON<SpawtCheckin[]>(KEYS.spawts)) ?? [];
}
export async function appendSpawtLocal(s: SpawtCheckin): Promise<void> {
  const list = await loadSpawts();
  list.unshift(s);
  await writeJSON(KEYS.spawts, list);
}

export type ConsentKind = "cgv" | "geoloc";

export async function setConsent(kind: ConsentKind, accepted: boolean): Promise<void> {
  const key = kind === "geoloc" ? KEYS.consent_geoloc : KEYS.consent_cgv;
  await AsyncStorage.setItem(key, accepted ? new Date().toISOString() : "");
}
export async function getConsent(kind: ConsentKind): Promise<string | null> {
  const key = kind === "geoloc" ? KEYS.consent_geoloc : KEYS.consent_cgv;
  return AsyncStorage.getItem(key);
}

export async function resetAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

// ─── helpers ────────────────────────────────────────

async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
