import { parseRowsForTest } from "../data-source.supabase";
import row from "./fixtures/place-row-live.json";
import { exploredPlaceIds, hasPlaceCoordinates } from "../place-discovery";
import { haversineKm } from "../matching";
import { isPlaceLocked } from "../paywall-geo";
import type { SpawtCheckin } from "../../types/spawt";

it("keeps a published documentary record readable without inventing a price, location or rating", () => {
  const [place] = parseRowsForTest([{ ...row, lat: null, lng: null, price_tier: null, place_adn: null }]);
  if (!place) throw new Error("Documentary record dropped");
  expect(place).toBeDefined(); expect(place.location.lat).toBeNull(); expect(place.price.tier).toBeNull();
  expect(place.adn.sample_size).toBe(0); expect(place.rating_display).toBe(0);
  expect(hasPlaceCoordinates(place)).toBe(false);
  expect(haversineKm(5.3, -4, null, null)).toBe(Infinity);
  expect(isPlaceLocked({ paywallEnabled: true, isGold: false, positionSource: "gps", spawterLat: 5.3, spawterLng: -4, placeLat: null, placeLng: null })).toBe(false);
});
it("exploration belongs to the account and requires its own confirmed, non-cancelled spawt", () => {
  const base = { spawter_id: "owner", checked_in_at: "2026-10-19T00:00:00Z", is_seed: false, is_cancelled: false, check_in_type: "manual" };
  const records = [
    { ...base, place_id: "mine" }, { ...base, place_id: "other", spawter_id: "another" },
    { ...base, place_id: "cancelled", is_cancelled: true }, { ...base, place_id: "seed", is_seed: true },
    { ...base, place_id: "passive", check_in_type: "passive" }, { ...base, place_id: "unconfirmed", checked_in_at: null },
  ] as SpawtCheckin[];
  expect([...exploredPlaceIds(records, "owner")]).toEqual(["mine"]);
  expect(exploredPlaceIds(records).size).toBe(0);
});
