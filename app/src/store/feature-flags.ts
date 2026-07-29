// Store Zustand léger pour les feature flags runtime — Story 1.8.
//
// Architecture §3 l266 : store séparé de spawter-store, hydraté depuis la
// table feature_flags via l'adapter data-source, polling TTL < 60s.
//
// Résolution :
//   1. Override spawter (spawter_id = current) prime.
//   2. Sinon, flag global (spawter_id IS NULL) pour le scope courant.
//   3. Sinon, false.
//
// V1 : pas de polling automatique au Root layout. Les consumers appellent
// `hydrate()` quand ils ont besoin (ex : Splash, Settings dev menu). Câblage
// auto = follow-up quand un premier consumer apparaît + listener
// `supabase.auth.onAuthStateChange` (Story 2.3 OTP).

import { create } from "zustand";

import { listFeatureFlags } from "../lib/data-source";
import type { FeatureFlag, FeatureFlagScope } from "../types/feature-flag";

interface FeatureFlagsState {
  /** Flag code → enabled. Résolu (override spawter > global). Inclut les overrides locaux (préservés à travers hydrate). */
  flags: Record<string, boolean>;
  /** Overrides locaux (dev menu) — non touchés par hydrate. */
  localOverrides: Record<string, boolean>;
  /** Scope courant — settable via dev menu ou JWT claim (V2). */
  scope: FeatureFlagScope;
  /** Spawter ID courant — set par hydrate(). */
  spawterId: string | null;
  /** Timestamp du dernier hydrate réussi. NULL = jamais. */
  lastSyncAt: number | null;
  loading: boolean;
  hydrate: (spawter_id: string | null) => Promise<void>;
  setScope: (scope: FeatureFlagScope) => void;
  setLocalOverride: (code: string, enabled: boolean) => void;
  clearLocalOverride: (code: string) => void;
}

function resolveFlags(
  rows: readonly FeatureFlag[],
  spawter_id: string | null,
  scope: FeatureFlagScope,
  localOverrides: Record<string, boolean>,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  // 1er pass : globaux (NULL spawter_id) pour le scope.
  for (const row of rows) {
    if (row.spawter_id === null && row.scope === scope) {
      result[row.flag_code] = row.enabled;
    }
  }
  // 2e pass : overrides spawter — priment.
  if (spawter_id) {
    for (const row of rows) {
      if (row.spawter_id === spawter_id && row.scope === scope) {
        result[row.flag_code] = row.enabled;
      }
    }
  }
  // 3e pass : overrides locaux (dev menu) — priment sur tout.
  for (const code of Object.keys(localOverrides)) {
    const v = localOverrides[code];
    if (v !== undefined) result[code] = v;
  }
  return result;
}

// Guard inflight : si deux callers déclenchent hydrate() simultanément, on
// retourne la même promise — pas de race ni de last-write-wins clobber.
let inflightPromise: Promise<void> | null = null;

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  flags: {},
  localOverrides: {},
  scope: "prod",
  spawterId: null,
  lastSyncAt: null,
  loading: false,

  hydrate: async (spawter_id) => {
    if (inflightPromise) return inflightPromise;
    inflightPromise = (async () => {
      try {
        set({ loading: true, spawterId: spawter_id });
        const rows = await listFeatureFlags(spawter_id);
        const { scope, localOverrides } = get();
        const flags = resolveFlags(rows, spawter_id, scope, localOverrides);
        set({ flags, lastSyncAt: Date.now(), loading: false });
      } finally {
        inflightPromise = null;
      }
    })();
    return inflightPromise;
  },

  setScope: (scope) => {
    set({ scope });
    // Re-resolve à partir des dernières rows en mémoire n'est pas possible
    // ici (on n'a stocké que `flags` résolu). Le caller relance hydrate()
    // après setScope si nécessaire.
  },

  setLocalOverride: (code, enabled) => {
    set((s) => ({
      localOverrides: { ...s.localOverrides, [code]: enabled },
      flags: { ...s.flags, [code]: enabled },
    }));
  },

  clearLocalOverride: (code) => {
    set((s) => {
      const next = { ...s.localOverrides };
      delete next[code];
      return { localOverrides: next };
    });
  },
}));

/**
 * Hook composant — retourne l'état du flag `code` (défaut false si non chargé).
 * Sélecteur granulaire pour éviter les rerenders sur l'ensemble du store.
 */
export function useFlag(code: string): boolean {
  return useFeatureFlagsStore((s) => s.flags[code] ?? false);
}
