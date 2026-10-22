// Story 4.1 — TaskManager.defineTask top-level pour le geofencing.
//
// CRITICAL — l'invocation `TaskManager.defineTask` DOIT être au niveau module
// (top-level, hors d'un composant React) pour survivre à l'OS-kill (Tecno/Infinix).
// Architecture §State Management Patterns + Story 4.1 Dev Notes §12 Risque #1.
//
// Le module est importé une seule fois depuis `app/app/_layout.tsx` pour déclencher
// l'enregistrement avant tout mount React.

import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";

import { useGuetActive } from "../../store/guet-active";

export const GUET_TASK = "spawt:guet-task";

export type GeofenceEventType = "enter" | "exit";

interface PlaceLookup {
  id: string;
  name: string;
}

let placeNameLookup: (place_id: string) => string | null = () => null;

/**
 * Permet à l'app (boot) d'injecter une fonction de résolution `place_id → name`
 * pour que les events `onGeofenceEnter` puissent enrichir la zone active avec
 * un nom lisible (cf. GuetIndicator). Story 4.1 = lookup synchrone simple ;
 * Story 4.2 enrichira avec lookup async fallback.
 */
export function setPlaceNameLookup(fn: (place_id: string) => string | null): void {
  placeNameLookup = fn;
}

/** Exposé pour Story 4.2 (étendra avec notification scheduling). */
export type GeofenceCallback = (
  type: GeofenceEventType,
  place: PlaceLookup,
) => void | Promise<void>;

let externalCallback: GeofenceCallback | null = null;
export function registerGeofenceCallback(cb: GeofenceCallback | null): void {
  externalCallback = cb;
}

interface RegionPayload {
  identifier: string;
}

interface TaskData {
  region?: RegionPayload;
  eventType?: number;
}

// ⚠️ defineTask top-level — ne JAMAIS déplacer dans une fonction/composant
// (project-context §Anti-patterns techniques).
if (typeof TaskManager.defineTask === "function") {
  TaskManager.defineTask(GUET_TASK, async ({ data, error }) => {
    if (error) {
      if (__DEV__) console.warn("[guet-task] error", error);
      return;
    }
    const region = (data as TaskData | undefined)?.region;
    if (!region) return;

    const place_id = region.identifier;
    const place_name = placeNameLookup(place_id) ?? place_id;
    const place: PlaceLookup = { id: place_id, name: place_name };

    if ((data as TaskData).eventType === Location.GeofencingEventType.Enter) {
      await handleEnter(place);
    } else if ((data as TaskData).eventType === Location.GeofencingEventType.Exit) {
      await handleExit(place);
    }
  });
}

async function handleEnter(place: PlaceLookup): Promise<void> {
  const nearby = await import("./guet-nearby");
  const context = await nearby.readGuetContext();
  if (!context?.places.some(p => p.id === place.id)) return;
  useGuetActive.getState().enter({ place_id: place.id, place_name: place.name });
  if (externalCallback) await externalCallback("enter", place);
  else await (await import("./guet-nearby")).handleNearbyEvent("enter", place.id);
}

async function handleExit(place: PlaceLookup): Promise<void> {
  useGuetActive.getState().exit();
  if (externalCallback) await externalCallback("exit", place);
  else await (await import("./guet-nearby")).handleNearbyEvent("exit", place.id);
}

/** Test-only : déclenche les handlers comme si la task avait été invoquée. */
export function _simulateGeofenceForTest(
  type: GeofenceEventType,
  place: PlaceLookup,
): Promise<void> {
  return type === "enter" ? handleEnter(place) : handleExit(place);
}
