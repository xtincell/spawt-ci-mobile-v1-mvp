import type { SpawtCheckin } from "../types/spawt";
import type { UserPalais } from "../types/palais";
import { buildManualSpawt } from "./guet/guet-spawt-actions";
import { isSupabaseConfigured } from "./data-source";
import { enqueueMany, flush, hasPendingMutation, saveSpawtToSupabaseOrEnqueue, type EnqueueInput } from "./offline-queue";
import { saveReviewPlaceSignals } from "./review-drafts";

export type ReviewPersistence = { persisted: "remote" | "queued" | "local" };

export async function persistReviewSpawt(row: SpawtCheckin, options?: {
  palais?: UserPalais; commitLocal: () => Promise<void>;
}): Promise<ReviewPersistence> {
  if (!isSupabaseConfigured) { await options?.commitLocal(); return { persisted: "local" }; }
  // Initialise aussi le backend de la file, y compris depuis un lien direct.
  await import("./data-source.supabase");
  if (!options) return saveSpawtToSupabaseOrEnqueue({ kind: "spawt_insert", row });
  const mutations: EnqueueInput[] = [{ kind: "spawt_insert", row }];
  if (options.palais) mutations.push({ kind: "palais_upsert", row: options.palais });
  await enqueueMany(mutations);
  await options.commitLocal();
  await flush();
  const pending = await Promise.all(mutations.map(hasPendingMutation));
  return { persisted: pending.some(Boolean) ? "queued" : "remote" };
}

const inFlight = new Map<string, Promise<SpawtCheckin>>();

/** Fiche et onglet Spawter partagent la même création/reprise durable. */
export function startManualReview(input: {
  spawterId: string; placeId: string;
  lat: number | null; lng: number | null; verified?: boolean;
  placeSignals?: readonly string[];
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
      is_verified: false,
      geolocation_source: "manual" as const,
    };
    if (input.placeSignals) await saveReviewPlaceSignals(input.spawterId, row.id, input.placeSignals);
    if (!reusable) await input.register(row);
    const receipt = await persistReviewSpawt(row);
    if (receipt.persisted === "remote") {
      const { verifyVisitPresence, readVerifiedVisit } = await import("./visit-presence");
      // Verification failure must not prevent a declared visit or its review.
      if (await verifyVisitPresence(row.id, input.spawterId).catch(() => false)) {
        const verified = await readVerifiedVisit(row.id, input.spawterId).catch(() => null);
        if (verified) {
          const { useSpawterStore } = await import("../store/spawter-store");
          await useSpawterStore.getState().reconcileVerifiedSpawt(verified);
          return verified;
        }
      }
    }
    return row;
  })();
  inFlight.set(key, action);
  const release = () => { if (inFlight.get(key) === action) inFlight.delete(key); };
  void action.then(release, release);
  return action;
}
