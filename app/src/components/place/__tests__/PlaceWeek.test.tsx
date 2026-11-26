import { placeClock } from "../PlaceWeek";
import { isOpenAt } from "../../../lib/opening-hours";
import { todayKey } from "../../OpeningHours";

const hours = { fri: [{ open: "07:00", close: "02:00" }], sat: [{ open: "08:00", close: "02:00" }] };
it("retient le service du vendredi à Abidjan à 1h59, et ferme à 2h", () => {
  const before = placeClock("Abidjan", new Date("2026-11-28T01:59:00Z"))!;
  const after = placeClock("Abidjan", new Date("2026-11-28T02:00:00Z"))!;
  expect(todayKey(before)).toBe("sat");
  expect(isOpenAt(hours, before)).toBe(true);
  expect(isOpenAt(hours, after)).toBe(false);
});
it("calcule l’heure de la ville du lieu et garde un fuseau inconnu indéterminé", () => {
  const instant = new Date("2026-11-27T23:30:00Z");
  expect(todayKey(placeClock("Abidjan", instant))).toBe("fri");
  expect(todayKey(placeClock("Douala", instant))).toBe("sat");
  expect(placeClock("Inconnue", instant)).toBeUndefined();
});
