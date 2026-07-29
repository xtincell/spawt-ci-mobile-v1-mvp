// Story 4.4 — Snapshot des invariants ANTIFRAUD_RULES.
// Verrou anti-drift entre TS (`app/src/types/spawt.ts`) et SQL (migration 0012).
// Si une constante change → snapshot casse → review obligatoire → mettre à jour le SQL.

import { ANTIFRAUD_RULES } from "../spawt";

test("ANTIFRAUD_RULES sont des invariants immuables — sync avec SQL triggers 0012", () => {
  expect(ANTIFRAUD_RULES).toMatchInlineSnapshot(`
{
  "GEOFENCE_RADIUS_METERS": 10,
  "MAX_SNOOZE_COUNT": 3,
  "MAX_SPAWTS_PER_DAY": 5,
  "MAX_SPEED_KMH_BETWEEN_SPAWTS": 100,
  "MIN_HOURS_SAME_PLACE": 4,
  "MIN_SESSION_MINUTES_FOR_ACTIVE": 5,
  "PASSIVE_CHECKIN_WEIGHT": 0.5,
  "PATTERN_DETECTION_THRESHOLD": 10,
  "PATTERN_DETECTION_WINDOW_DAYS": 7,
  "POST_LEAVE_WINDOW_MINUTES": 30,
  "PRESENCE_THRESHOLD_MINUTES": 15,
  "SNOOZE_DURATION_MINUTES": 15,
}
`);
});
