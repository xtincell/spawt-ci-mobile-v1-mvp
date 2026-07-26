// Tests Deno — helpers purs du cycle de vie abonnement (PRD §11.4).
//
// Run :
//   deno test supabase/functions/_shared/payment/subscription-lifecycle.test.ts

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

import {
  addMonthsUtc,
  computeExpiresAt,
  daysUntil,
  decideLifecycle,
  GRACE_DAYS,
} from "./subscription-lifecycle.ts";

Deno.test("addMonthsUtc: +1 mois simple", () => {
  const d = addMonthsUtc(new Date("2026-07-26T08:00:00.000Z"), 1);
  assertEquals(d.toISOString(), "2026-08-26T08:00:00.000Z");
});

Deno.test("addMonthsUtc: clamp fin de mois (31 janv → 28 févr)", () => {
  const d = addMonthsUtc(new Date("2026-01-31T10:00:00.000Z"), 1);
  assertEquals(d.toISOString(), "2026-02-28T10:00:00.000Z");
});

Deno.test("computeExpiresAt: gold_monthly +1 mois, gold_annual +12 mois", () => {
  const from = new Date("2026-07-26T00:00:00.000Z");
  assertEquals(computeExpiresAt("gold_monthly", from).toISOString(), "2026-08-26T00:00:00.000Z");
  assertEquals(computeExpiresAt("gold_annual", from).toISOString(), "2027-07-26T00:00:00.000Z");
});

Deno.test("computeExpiresAt: plans B2B mensuels — pro et b2b_gold +1 mois", () => {
  const from = new Date("2026-07-26T00:00:00.000Z");
  assertEquals(computeExpiresAt("pro", from).toISOString(), "2026-08-26T00:00:00.000Z");
  assertEquals(computeExpiresAt("b2b_gold", from).toISOString(), "2026-08-26T00:00:00.000Z");
});

Deno.test("daysUntil: J-3 / J / dépassé", () => {
  const now = new Date("2026-07-26T08:00:00.000Z");
  assertEquals(daysUntil(now, new Date("2026-07-29T08:00:00.000Z")), 3);
  assertEquals(daysUntil(now, new Date("2026-07-26T08:00:00.000Z")), 0);
  assertEquals(daysUntil(now, new Date("2026-07-25T08:00:00.000Z")) < 0, true);
});

Deno.test("decideLifecycle: active à J-3 → remind_j3", () => {
  const action = decideLifecycle({
    status: "active",
    expires_at: "2026-07-29T08:00:00.000Z",
    grace_until: null,
    now: new Date("2026-07-26T08:00:00.000Z"),
  });
  assertEquals(action.kind, "remind_j3");
});

Deno.test("decideLifecycle: active au jour J → remind_j0", () => {
  const action = decideLifecycle({
    status: "active",
    expires_at: "2026-07-26T12:00:00.000Z",
    grace_until: null,
    now: new Date("2026-07-26T08:00:00.000Z"),
  });
  assertEquals(action.kind, "remind_j0");
});

Deno.test("decideLifecycle: active expirée → grace avec grace_until = échéance + 7 j", () => {
  const action = decideLifecycle({
    status: "active",
    expires_at: "2026-07-25T08:00:00.000Z",
    grace_until: null,
    now: new Date("2026-07-26T08:00:00.000Z"),
  });
  assertEquals(action.kind, "to_grace");
  if (action.kind === "to_grace") {
    assertEquals(action.grace_until, "2026-08-01T08:00:00.000Z"); // +7 jours
  }
});

Deno.test("decideLifecycle: grace dépassée → expired", () => {
  const action = decideLifecycle({
    status: "grace",
    expires_at: "2026-07-10T08:00:00.000Z",
    grace_until: "2026-07-17T08:00:00.000Z",
    now: new Date("2026-07-26T08:00:00.000Z"),
  });
  assertEquals(action.kind, "to_expired");
});

Deno.test("decideLifecycle: grace encore ouverte → none", () => {
  const action = decideLifecycle({
    status: "grace",
    expires_at: "2026-07-24T08:00:00.000Z",
    grace_until: "2026-07-31T08:00:00.000Z",
    now: new Date("2026-07-26T08:00:00.000Z"),
  });
  assertEquals(action.kind, "none");
});

Deno.test("decideLifecycle: grace sans grace_until (incohérence) → expired", () => {
  const action = decideLifecycle({
    status: "grace",
    expires_at: null,
    grace_until: null,
    now: new Date("2026-07-26T08:00:00.000Z"),
  });
  assertEquals(action.kind, "to_expired");
});

Deno.test("decideLifecycle: active loin de l'échéance → none", () => {
  const action = decideLifecycle({
    status: "active",
    expires_at: "2026-09-26T08:00:00.000Z",
    grace_until: null,
    now: new Date("2026-07-26T08:00:00.000Z"),
  });
  assertEquals(action.kind, "none");
});

Deno.test("GRACE_DAYS = 7 (PRD §11.4)", () => {
  assertEquals(GRACE_DAYS, 7);
});
