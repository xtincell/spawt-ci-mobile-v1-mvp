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
