// Story 4.2 — Tests helpers confirmSpawt/snooze/passive/manual.

jest.mock("expo-crypto", () => ({
  __esModule: true,
  randomUUID: () => "deterministic-uuid",
}));

import {
  computeConfirmPatch,
  computeSnoozePatch,
  computePassivePatch,
  buildManualSpawt,
} from "../guet-spawt-actions";

const FIXED_NOW = new Date("2026-05-20T12:00:00Z");
const ARRIVED = new Date("2026-05-20T11:30:00Z").toISOString(); // 30min ago

describe("computeConfirmPatch", () => {
  it("active + accuracy 15m + battery 80 → is_verified true, type active", () => {
    const result = computeConfirmPatch(
      { arrived_at: ARRIVED },
      "active",
      { accuracy_meters: 15, battery_percent: 80 },
      FIXED_NOW,
    );
    expect(result.is_verified).toBe(true);
    expect(result.next_type).toBe("active");
    expect(result.forced_passive).toBe(false);
    expect(result.patch.check_in_type).toBe("active");
    expect(result.patch.session_duration_minutes).toBe(30);
  });

  it("active + accuracy 45m (>30) → bascule manual, is_verified false (NFR-GEO-02)", () => {
    const result = computeConfirmPatch(
      { arrived_at: ARRIVED },
      "active",
      { accuracy_meters: 45, battery_percent: 80 },
      FIXED_NOW,
    );
    expect(result.next_type).toBe("manual");
    expect(result.is_verified).toBe(false);
    expect(result.patch.geolocation_source).toBe("manual");
  });

  it("active + battery 8% (<10) → force passive (NFR-GEO-04)", () => {
    const result = computeConfirmPatch(
      { arrived_at: ARRIVED },
      "active",
      { accuracy_meters: 15, battery_percent: 8 },
      FIXED_NOW,
    );
    expect(result.forced_passive).toBe(true);
    expect(result.next_type).toBe("passive");
    expect(result.is_verified).toBe(false);
  });

  it("manual → toujours is_verified false (mode démo)", () => {
    const result = computeConfirmPatch(
      { arrived_at: ARRIVED },
      "manual",
      {},
      FIXED_NOW,
    );
    expect(result.next_type).toBe("manual");
    expect(result.is_verified).toBe(false);
  });
});

describe("computeSnoozePatch", () => {
  it("incrémente snooze_count et flag can_reschedule = true sous le cap", () => {
    const out = computeSnoozePatch({ snooze_count: 0 }, FIXED_NOW);
    expect(out.new_count).toBe(1);
    expect(out.can_reschedule).toBe(true);
    expect(out.patch.snooze_count).toBe(1);
  });

  it("cap à 3 (MAX_SNOOZE_COUNT) — can_reschedule false au 3e", () => {
    const out = computeSnoozePatch({ snooze_count: 2 }, FIXED_NOW);
    expect(out.new_count).toBe(3);
    expect(out.can_reschedule).toBe(false);
  });

  it("ne dépasse pas le cap", () => {
    const out = computeSnoozePatch({ snooze_count: 5 }, FIXED_NOW);
    expect(out.new_count).toBe(3);
  });
});

describe("computePassivePatch", () => {
  it("finalise en passive avec session_duration calculé", () => {
    const patch = computePassivePatch(
      { arrived_at: ARRIVED, left_at: null, is_verified: true },
      FIXED_NOW,
    );
    expect(patch.check_in_type).toBe("passive");
    expect(patch.session_duration_minutes).toBe(30);
    expect(patch.is_verified).toBe(true);
  });
});

describe("buildManualSpawt", () => {
  it("crée une row complète mode démo", () => {
    const s = buildManualSpawt("spawter-xyz", "place-1", 5.35, -3.97);
    expect(s.spawter_id).toBe("spawter-xyz");
    expect(s.place_id).toBe("place-1");
    expect(s.check_in_type).toBe("manual");
    expect(s.geolocation_source).toBe("manual");
    expect(s.is_verified).toBe(false);
    expect(s.is_seed).toBe(false);
    expect(s.id).toBe("deterministic-uuid");
  });
});
