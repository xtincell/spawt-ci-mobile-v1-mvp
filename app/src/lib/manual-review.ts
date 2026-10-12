import type { SpawtCheckin } from "../types/spawt";
import { buildManualSpawt } from "./guet/guet-spawt-actions";
import { isSupabaseConfigured } from "./data-source";
import { saveSpawtToSupabaseOrEnqueue } from "./offline-queue";

export type ReviewPersistence = { persisted: "remote" | "queued" | "local" };

export async function persistReviewSpawt(row: SpawtCheckin): Promise<ReviewPersistence> {
  if (!isSupabaseConfigured) return { persisted: "local" };
  // Initialise aussi le backend de la file, y compris depuis un lien direct.
  await import("./data-source.supabase");
  return saveSpawtToSupabaseOrEnqueue({ kind: "spawt_insert", row });
}

const inFlight = new Map<string, Promise<SpawtCheckin>>();

/** Fiche et onglet Spawter partagent la même création/reprise durable. */
export function startManualReview(input: {
  spawterId: string; placeId: string;
  lat: number | null; lng: number | null; verified?: boolean;
  spawts: readonly SpawtCheckin[];
  register: (row: SpawtCheckin) => Promise<void>;
}): Promise<SpawtCheckin> {
  const key = `${input.spawterId}:${input.placeId}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const action = (async () => {
    const reusable = input.spawts.find(s => s.spawter_id === input.spawterId && s.place_id === input.placeId
      && !s.is_seed && !s.is_cancelled && s.note_etoiles === null
      && Date.now() - Date.parse(s.arrived_at) < 4 * 3600_000);
    const row = reusable ?? {
      ...buildManualSpawt(input.spawterId, input.placeId, input.lat ?? 0, input.lng ?? 0),
      geolocation_lat: input.lat, geolocation_lng: input.lng,
      is_verified: Boolean(input.verified && input.lat !== null && input.lng !== null),
      geolocation_source: input.verified ? "gps" as const : "manual" as const,
    };
    if (!reusable) await input.register(row);
    await persistReviewSpawt(row);
    return row;
  })();
  inFlight.set(key, action);
  const release = () => { if (inFlight.get(key) === action) inFlight.delete(key); };
  void action.then(release, release);
  return action;
}
