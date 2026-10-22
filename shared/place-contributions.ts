export type ContributionKind = "menu" | "location";
export interface LocationProof { lat: number; lng: number; accuracy_meters: number; observed_at: string }
export interface PlaceContribution {
  id: string; place_id: string; spawter_id: string; kind: ContributionKind;
  proposal: Partial<LocationProof> & { photo_paths?: string[]; price_tier?: number; avg_ticket_xof?: number };
  comment: string; status: "pending" | "approved" | "rejected"; review_note: string;
  offered_reward_paws: number; reward_paws: number; created_at: string;
  before_values?: unknown; after_values?: unknown;
}
export const CONTRIBUTION_BUCKET = "place-contributions";
export const MENU_STORAGE_PREFIX = `storage://${CONTRIBUTION_BUCKET}/`;
export function contributionMenuPath(value: string): string | null {
  if (!value.startsWith(MENU_STORAGE_PREFIX)) return null;
  const path = value.slice(MENU_STORAGE_PREFIX.length);
  return /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[0-2]\.jpg$/.test(path) ? path : null;
}
export function preciseRecentLocation(proof: LocationProof | null, now = Date.now()): proof is LocationProof {
  if (!proof) return false;
  const age = now - Date.parse(proof.observed_at);
  return Number.isFinite(proof.lat) && Math.abs(proof.lat) <= 90
    && Number.isFinite(proof.lng) && Math.abs(proof.lng) <= 180
    && Number.isFinite(proof.accuracy_meters) && proof.accuracy_meters >= 0 && proof.accuracy_meters <= 100
    && Number.isFinite(age) && age >= -60_000 && age <= 600_000;
}
