// Tests Deno — catalogue de plans + calcul TTC (TVA CI 18 %).
//
// Run :
//   deno test supabase/functions/_shared/payment/types.test.ts

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

import {
  B2B_PLAN_PRICING,
  b2bRoleForPlan,
  computeTtc,
  GOLD_PLAN_PRICING,
  isB2bPlan,
  isGoldPlan,
  isPaidPlan,
  PLAN_PRICING,
} from "./types.ts";

Deno.test("computeTtc: TVA 18 % arrondie au franc — plans B2C", () => {
  assertEquals(computeTtc(2500), 2950);
  assertEquals(computeTtc(25000), 29500);
});

Deno.test("computeTtc: plans B2B — pro 15 000 HT → 17 700 TTC, b2b_gold 65 000 HT → 76 700 TTC", () => {
  assertEquals(computeTtc(B2B_PLAN_PRICING.pro.price_ht), 17700);
  assertEquals(computeTtc(B2B_PLAN_PRICING.b2b_gold.price_ht), 76700);
});

Deno.test("catalogue B2B: prix HT et durées mensuelles", () => {
  assertEquals(B2B_PLAN_PRICING.pro.price_ht, 15000);
  assertEquals(B2B_PLAN_PRICING.pro.months, 1);
  assertEquals(B2B_PLAN_PRICING.b2b_gold.price_ht, 65000);
  assertEquals(B2B_PLAN_PRICING.b2b_gold.months, 1);
});

Deno.test("PLAN_PRICING: fusion des catalogues B2C + B2B (4 plans)", () => {
  assertEquals(Object.keys(PLAN_PRICING).sort(), [
    "b2b_gold",
    "gold_annual",
    "gold_monthly",
    "pro",
  ]);
  assertEquals(PLAN_PRICING.gold_monthly, GOLD_PLAN_PRICING.gold_monthly);
  assertEquals(PLAN_PRICING.pro, B2B_PLAN_PRICING.pro);
});

Deno.test("isGoldPlan / isB2bPlan / isPaidPlan: partitions exactes", () => {
  assertEquals(isGoldPlan("gold_monthly"), true);
  assertEquals(isGoldPlan("pro"), false);
  assertEquals(isB2bPlan("pro"), true);
  assertEquals(isB2bPlan("b2b_gold"), true);
  assertEquals(isB2bPlan("gold_annual"), false);
  assertEquals(isPaidPlan("gold_monthly"), true);
  assertEquals(isPaidPlan("gold_annual"), true);
  assertEquals(isPaidPlan("pro"), true);
  assertEquals(isPaidPlan("b2b_gold"), true);
  assertEquals(isPaidPlan("gold_weekly"), false);
  assertEquals(isPaidPlan(null), false);
  assertEquals(isPaidPlan(42), false);
});

Deno.test("b2bRoleForPlan: pro → 'pro', b2b_gold → 'gold' (rôles 0043)", () => {
  assertEquals(b2bRoleForPlan("pro"), "pro");
  assertEquals(b2bRoleForPlan("b2b_gold"), "gold");
});
