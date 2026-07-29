// Story 4.3 — Wire-up entre `offline-queue.ts` et `@react-native-community/netinfo`.
// Séparé pour rester :
//   - testable (le core `offline-queue.ts` reste pur, sans dépendance native)
//   - tolérant en mode web/test où NetInfo peut être absent

import { Platform } from "react-native";

import { isSupabaseConfigured, upsertSpawt, updateSpawt, saveSpawter } from "./data-source";
import {
  initOfflineQueue,
  setSyncBackend,
  type SyncBackend,
} from "./offline-queue";

let unsubscribe: (() => void) | null = null;

const backend: SyncBackend = {
  upsertSpawt: (row) => upsertSpawt(row),
  updateSpawt: (id, patch) => updateSpawt(id, patch),
  // `saveSpawter` ne renvoie rien : une résolution sans exception vaut succès,
  // un rejet est capté par `tryDrainEntry` et l'entrée sera retentée.
  upsertSpawter: (row) => saveSpawter(row).then(() => true),
};

/**
 * À appeler une seule fois au Root layout. No-op en mode démo (pas de Supabase
 * configuré → rien à synchroniser) ou si NetInfo est indisponible.
 */
export async function bootOfflineQueue(): Promise<void> {
  if (!isSupabaseConfigured) return;
  setSyncBackend(backend);

  // Import dynamique — évite que les builds web/tests sans NetInfo crashent.
  let NetInfoMod: typeof import("@react-native-community/netinfo") | null = null;
  try {
    NetInfoMod = await import("@react-native-community/netinfo");
  } catch (err) {
    if (__DEV__) console.info("[offline-queue] NetInfo unavailable — skipping wire", err);
    return;
  }
  if (!NetInfoMod) return;

  const NetInfo = NetInfoMod.default ?? NetInfoMod;

  // Note Platform — sur web, NetInfo a un fallback navigator.onLine, OK.
  if (__DEV__) console.info("[offline-queue] init for platform", Platform.OS);

  let wasOnline = true;
  unsubscribe = initOfflineQueue({
    subscribe: (cb) => {
      const sub = NetInfo.addEventListener?.((state) => {
        const online = state.isConnected !== false;
        // Trigger seulement sur transitions false → true.
        if (!wasOnline && online) cb();
        wasOnline = online;
      });
      return () => {
        if (typeof sub === "function") sub();
        else if (sub && typeof sub === "object" && "remove" in sub) {
          (sub as { remove: () => void }).remove();
        }
      };
    },
    isOnline: async () => {
      try {
        const state = await NetInfo.fetch?.();
        return state?.isConnected !== false;
      } catch {
        return false;
      }
    },
  });
}

export function shutdownOfflineQueue(): void {
  unsubscribe?.();
  unsubscribe = null;
  setSyncBackend(null);
}
