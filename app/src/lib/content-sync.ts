import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

let revision = 0;
const listeners = new Set<() => void>();
export function invalidatePublishedContent(): void {
  revision += 1;
  listeners.forEach(listener => listener());
}
export function subscribePublishedContent(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useContentRevision(): number {
  return useSyncExternalStore(subscribePublishedContent, () => revision, () => 0);
}

/** One foreground poll for the whole app. Server time covers scheduled news,
 * events and offers; no private editorial table is subscribed or downloaded. */
export function startContentSync(readStatus: () => Promise<string>): () => void {
  let stopped = false;
  let busy = false;
  let status: string | null = null;
  const poll = async () => {
    if (stopped || busy || AppState.currentState !== "active") return;
    busy = true;
    try {
      const next = await readStatus();
      if (!stopped && next !== status) {
        status = next;
        invalidatePublishedContent();
      }
    } catch { /* Existing content remains readable; next poll retries. */ }
    finally { busy = false; }
  };
  void poll();
  const timer = setInterval(() => { void poll(); }, 30_000);
  const sub = AppState.addEventListener("change", state => {
    if (state === "active") { invalidatePublishedContent(); void poll(); }
  });
  return () => { stopped = true; clearInterval(timer); sub.remove(); };
}
