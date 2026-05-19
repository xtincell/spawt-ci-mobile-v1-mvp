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
  /** Story 3.6 — set des place_id sauvegardés en favoris (local-first, Sprint 1). */
  saved_places: "spawt:saved_places",
  /** Story 3.5 — queue des recherches récentes (cap 10, FIFO). */
  recent_searches: "spawt:recent_searches",
} as const;

// P9 — migration one-shot de la clé legacy `spawt:consent:data` → `spawt:consent:cgv`.
// Avant Story 2.2, la consent CGV était stockée sous la clé `:data`. Les devices
// alpha pre-Story-2.2 perdraient leur timestamp sans cette migration.
// Idempotente : si l'ancienne clé n'existe pas (ou la nouvelle existe déjà), no-op.
//
// P-31 — race-safe via promesse mémoïsée. Le boolean `_consentMigrationDone`
// d'origine fermait la porte au 2e appelant AVANT que le 1er ait terminé son
// `await`, donc 2 setConsent/getConsent concurrents pouvaient short-circuit
// la migration avec la valeur legacy encore en place. Pattern « cache the
// in-flight promise » : tous les appelants `await` la même promesse.
let migrationPromise: Promise<void> | null = null;
async function runMigration(): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem("spawt:consent:data");
    if (legacy === null) return;
    const existing = await AsyncStorage.getItem(KEYS.consent_cgv);
    if (existing === null && legacy.length > 0) {
      await AsyncStorage.setItem(KEYS.consent_cgv, legacy);
    }
    await AsyncStorage.removeItem("spawt:consent:data");
  } catch (err) {
    if (__DEV__) console.warn("[storage] consent legacy migration failed", err);
  }
}
function migrateLegacyConsentDataKey(): Promise<void> {
  if (migrationPromise === null) {
    // P-25 round 3 — Safety net : si la promesse rejete (assertion fail, OOM,
    // erreur inattendue dans `runMigration` malgré son try/catch), on reset
    // pour que les appelants suivants puissent retenter. Sans ça, tous les
    // `await` futurs hériteraient de la promesse rejected → blocage permanent
    // des writes consent.
    migrationPromise = runMigration().catch((err) => {
      migrationPromise = null;
      throw err;
    });
  }
  return migrationPromise;
}

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
  await migrateLegacyConsentDataKey();
  const key = kind === "geoloc" ? KEYS.consent_geoloc : KEYS.consent_cgv;
  await AsyncStorage.setItem(key, accepted ? new Date().toISOString() : "");
}
export async function getConsent(kind: ConsentKind): Promise<string | null> {
  await migrateLegacyConsentDataKey();
  const key = kind === "geoloc" ? KEYS.consent_geoloc : KEYS.consent_cgv;
  return AsyncStorage.getItem(key);
}

export async function resetAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

// ─── Story 3.6 — favoris (saved places) ─────────────

export async function loadSaved(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.saved_places);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Retourne `true` si l'écriture AsyncStorage a réussi, `false` sinon. Le
 * caller (store.toggleSaved) doit gate la mutation du state Zustand sur ce
 * boolean — sinon state et disque divergent jusqu'au prochain hydrate.
 */
export async function saveSavedLocal(set: Set<string>): Promise<boolean> {
  try {
    await AsyncStorage.setItem(KEYS.saved_places, JSON.stringify([...set]));
    return true;
  } catch (err) {
    if (__DEV__) console.warn("[storage] saveSavedLocal failed", err);
    return false;
  }
}

// ─── Story 3.5 — recherches récentes ─────────────

const RECENT_SEARCHES_CAP = 10;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.recent_searches);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    // Trim + dedup case-insensitive à la lecture pour cleanup les états legacy.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of arr) {
      if (typeof s !== "string") continue;
      const trimmed = s.trim();
      if (trimmed.length === 0) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  } catch {
    return [];
  }
}

export async function addRecentSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return;
  try {
    const existing = await getRecentSearches();
    // Dedup case-insensitive sur le contenu trimmé : si déjà présent (même
    // après normalisation), on le remonte en tête. Évite que "  café" et
    // "café" coexistent dans la liste alors qu'ils représentent la même
    // requête côté user.
    const lower = trimmed.toLowerCase();
    const filtered = existing.filter((q) => q.trim().toLowerCase() !== lower);
    const next = [trimmed, ...filtered].slice(0, RECENT_SEARCHES_CAP);
    await AsyncStorage.setItem(KEYS.recent_searches, JSON.stringify(next));
  } catch (err) {
    if (__DEV__) console.warn("[storage] addRecentSearch failed", err);
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.recent_searches);
  } catch (err) {
    if (__DEV__) console.warn("[storage] clearRecentSearches failed", err);
  }
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
