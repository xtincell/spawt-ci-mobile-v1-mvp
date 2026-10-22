// Tests Deno — codes de plan, périodes, libellés provider, calcul TTC historique.
// Les prix vivent dans la table `plans` (0079) : aucun catalogue de montants
// ici. Lecture d'un plan et montants figés : plans.test.ts.
//
// Run :
//   deno test supabase/functions/_shared/payment/types.test.ts

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

import * as types from "./types.ts";
import {
  b2bRoleForPlan,
  computeTtc,
  isB2bPlan,
  isGoldPlan,
  isPaidPlan,
  isPlanPeriod,
  PERIOD_MONTHS,
  PLAN_DESCRIPTION,
  PLAN_PERIOD,
} from "./types.ts";

Deno.test("types.ts ne porte plus aucun catalogue de prix (source unique : plans)", () => {
  const exported = Object.keys(types);
  for (const name of [
    "PLAN_PRICING",
    "GOLD_PLAN_PRICING",
    "B2B_PLAN_PRICING",
    "planPriceTtc",
    "fixedTtcInvoiceAmounts",
  ]) {
    assertEquals(exported.includes(name), false, `${name} ne doit plus exister`);
  }
});

Deno.test("computeTtc: calcul historique HT + TVA 18 % arrondie au franc", () => {
  assertEquals(computeTtc(2500), 2950);
  assertEquals(computeTtc(25000), 29500);
  assertEquals(computeTtc(15000), 17700);
  assertEquals(computeTtc(65000), 76700);
});

Deno.test("computeTtc: aucun HT entier ne donne 60 000 — d'où le prix payé saisi (0079)", () => {
  assertEquals(computeTtc(50847), 59999);
  assertEquals(computeTtc(50848), 60001);
});

Deno.test("PERIOD_MONTHS / PLAN_PERIOD: mensuels, sauf gold_annual (12 mois)", () => {
  assertEquals(PERIOD_MONTHS, { monthly: 1, annual: 12 });
  assertEquals(PLAN_PERIOD, {
    gold_monthly: "monthly",
    gold_annual: "annual",
    pro: "monthly",
    b2b_gold: "monthly",
  });
});

Deno.test("PLAN_DESCRIPTION: un libellé provider par plan vendu, sans montant", () => {
  assertEquals(Object.keys(PLAN_DESCRIPTION).sort(), ["b2b_gold", "gold_annual", "gold_monthly", "pro"]);
  for (const label of Object.values(PLAN_DESCRIPTION)) {
    assertEquals(/\d{3}|F\s?CFA|FCFA|XOF|TTC/.test(label), false, label);
  }
});

Deno.test("isGoldPlan / isB2bPlan / isPaidPlan / isPlanPeriod: partitions exactes", () => {
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
  assertEquals(isPlanPeriod("monthly"), true);
  assertEquals(isPlanPeriod("annual"), true);
  assertEquals(isPlanPeriod("lifetime"), false);
});

Deno.test("b2bRoleForPlan: pro → 'pro', b2b_gold → 'gold' (rôles 0043)", () => {
  assertEquals(b2bRoleForPlan("pro"), "pro");
  assertEquals(b2bRoleForPlan("b2b_gold"), "gold");
});
