import type { Place } from "../types/place";
import type { SpawtCheckin } from "../types/spawt";

/** SPAWT uses (0, 0) as the placeholder for a place that has not been located. */
export function isMapCoordinate(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180
    && (lat !== 0 || lng !== 0);
}

export function hasPlaceCoordinates<T extends Place>(place: T): place is T & { location: { lat: number; lng: number } } {
  return isMapCoordinate(place.location?.lat, place.location?.lng);
}
/** A catalogue entry never counts as this person's exploration. Passive,
 * cancelled and seed records must not mark a place as personally explored. */
export function exploredPlaceIds(spawts: readonly SpawtCheckin[], spawterId?: string): Set<string> {
  return new Set(spawts.filter(row => row.spawter_id === spawterId && row.checked_in_at && !row.is_cancelled && !row.is_seed && row.check_in_type !== "passive").map(row => row.place_id));
}
