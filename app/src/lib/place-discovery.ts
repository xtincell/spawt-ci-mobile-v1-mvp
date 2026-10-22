import type { Place } from "../types/place";
import type { SpawtCheckin } from "../types/spawt";

export function hasPlaceCoordinates<T extends Place>(place: T): place is T & { location: { lat: number; lng: number } } {
  return place.location.lat !== null && place.location.lng !== null && Number.isFinite(place.location.lat) && Number.isFinite(place.location.lng);
}
/** A catalogue entry never counts as this person's exploration. Passive,
 * cancelled and seed records must not mark a place as personally explored. */
export function exploredPlaceIds(spawts: readonly SpawtCheckin[], spawterId?: string): Set<string> {
  return new Set(spawts.filter(row => row.spawter_id === spawterId && row.checked_in_at && !row.is_cancelled && !row.is_seed && row.check_in_type !== "passive").map(row => row.place_id));
}
