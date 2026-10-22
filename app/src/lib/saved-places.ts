// Favoris : cache et changements en attente dans UN document AsyncStorage.
// Le serveur fait foi, sauf pour les choix locaux explicitement non acquittés.
// Le réseau ne tient jamais le verrou des écritures locales.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SAVED_PLACES_KEY = "spawt:saved_places";
type Change = { place_id: string; saved: boolean; revision: string };
type Document = { version: 1; spawter_id: string | null; ids: string[]; pending: Change[] };
let tail: Promise<unknown> = Promise.resolve();
function withStorage<T>(action: () => Promise<T>): Promise<T> {
  const result = tail.then(action);
  tail = result.catch(() => undefined);
  return result;
}
let sequence = 0;
function empty(owner: string | null, ids: Iterable<string> = []): Document {
  return { version: 1, spawter_id: owner, ids: [...ids], pending: [] };
}
export class SavedPlacesCacheError extends Error {}
async function read(owner: string | null, fallback: Iterable<string> = []): Promise<Document> {
  try { return await readDocument(owner, fallback); }
  catch (error) {
    throw new SavedPlacesCacheError(error instanceof Error ? error.message : "saved_places_unreadable");
  }
}
async function readDocument(owner: string | null, fallback: Iterable<string> = []): Promise<Document> {
  const raw = await AsyncStorage.getItem(SAVED_PLACES_KEY);
  if (raw === null) return empty(owner, fallback);
  const value: unknown = JSON.parse(raw);
  // Ancien cache : aucune preuve d'une mutation non synchronisée. Ne jamais
  // le convertir en ajouts à rejouer : cela ressusciterait les suppressions.
  if (Array.isArray(value) && value.every((id) => typeof id === "string")) {
    return empty(owner, new Set(value));
  }
  const doc = value as Document | null;
  if (!doc || doc.version !== 1 || !(doc.spawter_id === null || typeof doc.spawter_id === "string") ||
      !Array.isArray(doc.ids) || doc.ids.some((id) => typeof id !== "string") ||
      !Array.isArray(doc.pending) || doc.pending.some((c) => !c || typeof c.place_id !== "string" ||
        typeof c.saved !== "boolean" || typeof c.revision !== "string" || !c.revision) ||
      new Set(doc.pending.map((c) => c.place_id)).size !== doc.pending.length) {
    throw new Error("saved_places_invalid");
  }
  if (doc.spawter_id !== owner) throw new Error("saved_places_owner_mismatch");
  return doc;
}
async function write(doc: Document): Promise<void> {
  await AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(doc));
}
export function loadSavedPlaces(owner: string | null): Promise<Set<string>> {
  return withStorage(async () => {
    try { return new Set((await read(owner)).ids); }
    catch (err) {
      // Un cache identifié comme appartenant à A n'est jamais affiché à B.
      if (err instanceof Error && err.message === "saved_places_owner_mismatch") return new Set();
      throw err;
    }
  });
}
export function purgeSavedPlaces(): Promise<void> {
  return withStorage(() => AsyncStorage.removeItem(SAVED_PLACES_KEY));
}
export function toggleSavedPlace(
  owner: string | null, place_id: string, current: () => Set<string>,
  isCurrent: () => boolean, publish: (ids: Set<string>) => void,
): Promise<boolean> {
  return withStorage(async () => {
    if (!isCurrent()) throw new Error("saved_places_session_changed");
    const doc = await read(owner, current());
    if (!isCurrent()) throw new Error("saved_places_session_changed");
    const ids = new Set(doc.ids);
    const saved = !ids.has(place_id);
    if (saved) ids.add(place_id); else ids.delete(place_id);
    const change: Change = { place_id, saved, revision: `${Date.now()}-${++sequence}` };
    await write({ ...doc, ids: [...ids], pending: [
      ...doc.pending.filter((c) => c.place_id !== place_id), change,
    ] });
    if (!isCurrent()) throw new Error("saved_places_session_changed");
    publish(ids);
    return saved;
  });
}

type Flight = { again: boolean; promise: Promise<void> };
const flights = new Map<string, Flight>();
/** Même session : un seul envoi ; un geste pendant l'envoi demande une reprise. */
export function syncSavedPlaces(
  owner: string, session: number, isCurrent: () => boolean, publish: (ids: Set<string>) => void,
): Promise<void> {
  const key = `${session}:${owner}`;
  const existing = flights.get(key);
  if (existing) { existing.again = true; return existing.promise; }
  const flight: Flight = { again: false, promise: Promise.resolve() };
  flight.promise = (async () => {
    do {
      flight.again = false;
      await reconcile(owner, isCurrent, publish);
    } while (flight.again && isCurrent());
  })().finally(() => { if (flights.get(key) === flight) flights.delete(key); });
  flights.set(key, flight);
  return flight.promise;
}
async function reconcile(owner: string, isCurrent: () => boolean, publish: (ids: Set<string>) => void): Promise<void> {
  if (!isCurrent()) return;
  await withStorage(async () => {
    if (!isCurrent()) return;
    const doc = await read(owner);
    if (isCurrent()) publish(new Set(doc.ids));
  });
  if (!isCurrent()) return;
  const { listSavedPlaceIds, saveSavedPlace, deleteSavedPlace } = await import("./data-source");
  if (!isCurrent()) return;
  const remote = await listSavedPlaceIds(owner);
  if (remote === null || !isCurrent()) return;
  const snapshot = await withStorage(() => read(owner));
  const ids = new Set(remote);
  for (const change of snapshot.pending) {
    if (!isCurrent()) return;
    try {
      if (change.saved) await saveSavedPlace(owner, change.place_id);
      else await deleteSavedPlace(owner, change.place_id);
    } catch {
      // Aucune confirmation serveur : on conserve l'intention pour la reprise.
      continue;
    }
    if (!isCurrent()) return;
    if (change.saved) ids.add(change.place_id); else ids.delete(change.place_id);
    await withStorage(async () => {
      if (!isCurrent()) return;
      const doc = await read(owner);
      if (!isCurrent()) return;
      await write({ ...doc, pending: doc.pending.filter((c) => c.revision !== change.revision) });
    });
  }
  await withStorage(async () => {
    if (!isCurrent()) return;
    const doc = await read(owner);
    if (!isCurrent()) return;
    for (const change of doc.pending) {
      if (change.saved) ids.add(change.place_id); else ids.delete(change.place_id);
    }
    await write({ ...doc, ids: [...ids] });
    if (isCurrent()) publish(ids);
  });
}
