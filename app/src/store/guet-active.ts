// Story 4.1 — Micro-store éphémère pour la zone géofence active.
// Non persisté (au boot, l'état est null — le geofence redétectera si toujours en zone).
// Pattern Option B : ne pas polluer spawter-store avec un champ éphémère qui drifterait
// au boot (architecture §State Management Patterns — séparation durable/transient).

import { create } from "zustand";

export interface GuetActiveZone {
  place_id: string;
  place_name: string;
}

interface GuetActiveState {
  active: GuetActiveZone | null;
  enter: (zone: GuetActiveZone) => void;
  exit: () => void;
}

export const useGuetActive = create<GuetActiveState>((set) => ({
  active: null,
  enter: (zone) => set({ active: zone }),
  exit: () => set({ active: null }),
}));

export function useGuetActiveZone(): GuetActiveZone | null {
  return useGuetActive((s) => s.active);
}
