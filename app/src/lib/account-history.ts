import { listSpawtsForSpawter, listTitresForSpawter } from "./data-source";
import { requireAccountSession } from "./account-recovery";
import type { SpawtCheckin } from "../types/spawt";
import type { CollectionTitreRow } from "../types/collection-titres";

export interface AccountHistory {
  spawts: SpawtCheckin[];
  collectionTitres: CollectionTitreRow[];
}

/** Reconnection must restore the same history that produced the profile's
 * counters. Read before clearing local state; a failed read is not an empty
 * history. Recheck the SDK identity before publishing any result. */
export async function readAccountHistory(owner: string, signal?: AbortSignal): Promise<AccountHistory> {
  await requireAccountSession(owner);
  const abort = new AbortController();
  const cancel = () => abort.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel);
  const timeout = setTimeout(cancel, 15_000);
  try {
    const [spawts, collectionTitres] = await Promise.all([
      listSpawtsForSpawter(owner, abort.signal),
      listTitresForSpawter(owner, abort.signal),
    ]);
    if (abort.signal.aborted) throw new Error("ACCOUNT_READ_FAILED");
    await requireAccountSession(owner);
    if (![...spawts, ...collectionTitres].every((row) => row.spawter_id === owner)) {
      throw new Error("ACCOUNT_INVALID");
    }
    return { spawts, collectionTitres };
  } catch (error) {
    if (error instanceof Error && /^ACCOUNT_/.test(error.message)) throw error;
    throw new Error("ACCOUNT_READ_FAILED");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
