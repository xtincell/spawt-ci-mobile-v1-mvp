import { create } from "zustand";
import { useEffect } from "react";
import { useSpawterStore } from "./spawter-store";
import { useContentRevision } from "../lib/content-sync";
import { emptyOutings, enqueueOuting, localOutings, syncOutings, type MenuItem, type OutingAction, type OutingsSnapshot } from "../lib/outings";

interface State {
  owner: string | null; snapshot: OutingsSnapshot; loading: boolean; failed: boolean; pending: number; rejected: number; pendingPlaces: Record<string, boolean>;
  refresh: (owner: string) => Promise<void>;
  perform: (action: OutingAction, payload: Record<string, unknown>, dish?: MenuItem) => Promise<void>;
}
export const useOutingsStore = create<State>((set, get) => ({
  owner: null, snapshot: emptyOutings(), loading: false, failed: false, pending: 0, rejected: 0, pendingPlaces: {},
  refresh: async owner => {
    const current = () => useSpawterStore.getState().spawter?.id === owner;
    if (!current()) return;
    if (get().owner !== owner) set({ owner, snapshot: emptyOutings(), pending: 0, rejected: 0, pendingPlaces: {} });
    set({ loading: true, failed: false });
    try {
      const local = await localOutings(owner); if (current()) set(local);
      await syncOutings(owner, current);
      if (current()) await useSpawterStore.getState().refreshSaved().catch(() => undefined);
      const remote = await localOutings(owner); if (current()) set(remote);
    } catch { if (current()) set({ failed: true }); }
    finally { if (current()) set({ loading: false }); }
  },
  perform: async (action, payload, dish) => {
    const owner = useSpawterStore.getState().spawter?.id;
    if (!owner) throw new Error("account_required");
    const current = () => useSpawterStore.getState().spawter?.id === owner;
    await enqueueOuting(owner, action, payload, current, dish);
    const local = await localOutings(owner);
    if (current()) set({ owner, ...local });
    await get().refresh(owner);
    if (current() && (action === "list_add" || action === "unsave")) await useSpawterStore.getState().refreshSaved().catch(() => undefined);
  },
}));
const empty = emptyOutings();
export async function refreshCurrentOutings(): Promise<void> {
  const owner = useSpawterStore.getState().spawter?.id;
  if (owner) await useOutingsStore.getState().refresh(owner);
}
export function useOutings() {
  const owner = useSpawterStore(s => s.spawter?.id ?? null);
  const state = useOutingsStore();
  const revision = useContentRevision();
  useEffect(() => { if (owner) void useOutingsStore.getState().refresh(owner); }, [owner, revision]);
  return { ...state, pendingPlaces: state.owner === owner ? state.pendingPlaces : {}, snapshot: state.owner === owner ? state.snapshot : empty, refresh: () => owner ? state.refresh(owner) : Promise.resolve() };
}
