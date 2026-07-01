// Câblage MVP — persistance des rows pending du Guet (AsyncStorage).
//
// Une row "pending" = entrée en zone détectée, spawt pas encore confirmé/passif.
// DOIT survivre à l'OS-kill : la notif 15min est schedulée côté OS, et à la
// réception (app relancée à froid) le handler doit retrouver la row pour la
// fermer. Modèle read-modify-write simple — fréquence très faible (quelques
// events/jour), pas besoin de cache en mémoire.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SpawtCheckin } from "../../types/spawt";

const KEY = "spawt:guet:pending";

type PendingMap = Record<string, SpawtCheckin>;

async function load(): Promise<PendingMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PendingMap;
  } catch (err) {
    if (__DEV__) console.warn("[guet-pending] load failed", err);
    return {};
  }
}

async function persist(map: PendingMap): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch (err) {
    if (__DEV__) console.warn("[guet-pending] persist failed", err);
  }
}

export async function listPending(): Promise<SpawtCheckin[]> {
  return Object.values(await load());
}

export async function getPending(row_id: string): Promise<SpawtCheckin | null> {
  const map = await load();
  return map[row_id] ?? null;
}

/** Row pending encore "ouverte" (pas sortie de zone) pour un lieu donné. */
export async function findOpenPendingByPlace(
  place_id: string,
): Promise<SpawtCheckin | null> {
  const map = await load();
  for (const row of Object.values(map)) {
    if (row.place_id === place_id && row.left_at === null) return row;
  }
  return null;
}

export async function upsertPending(row: SpawtCheckin): Promise<void> {
  const map = await load();
  map[row.id] = row;
  await persist(map);
}

export async function patchPending(
  row_id: string,
  patch: Partial<SpawtCheckin>,
): Promise<SpawtCheckin | null> {
  const map = await load();
  const row = map[row_id];
  if (!row) return null;
  const updated = { ...row, ...patch };
  map[row_id] = updated;
  await persist(map);
  return updated;
}

export async function removePending(row_id: string): Promise<void> {
  const map = await load();
  if (!(row_id in map)) return;
  delete map[row_id];
  await persist(map);
}

/** Test-only. */
export async function _clearPendingForTest(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
