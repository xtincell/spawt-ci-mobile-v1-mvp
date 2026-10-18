// Tests Deno — lecture d'un plan dans `plans` (0079) et montants de facture.
// Les montants ci-dessous sont des fixtures : la vraie valeur est celle que
// l'équipe saisit dans la page Tarifs de la console.
//
// Run :
//   deno test supabase/functions/_shared/payment/plans.test.ts

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

import {
  invoiceAmountsForSubscription,
  loadSellablePlan,
  parseSellablePlan,
  type PlansReader,
  SELLABLE_PLAN_COLUMNS,
} from "./plans.ts";

// Une ligne `plans` telle que PostgREST la rend après 0079.
const GOLD_LIEU = {
  code: "b2b_gold",
  period: "monthly",
  price_ttc: 60000,
  price_ht: 50847,
  tva_amount: 9153,
  is_active: true,
};

Deno.test("parseSellablePlan: Gold lieu actif, 60 000 = 50 847 + 9 153", () => {
  assertEquals(parseSellablePlan(GOLD_LIEU, "b2b_gold"), {
    ok: true,
    plan: { code: "b2b_gold", period: "monthly", price_ttc: 60000, price_ht: 50847, tva_amount: 9153 },
  });
});

Deno.test("parseSellablePlan: HT numeric(12,2) rendu en texte accepté s'il est entier", () => {
  const r = parseSellablePlan({ ...GOLD_LIEU, price_ht: "50847.00" }, "b2b_gold");
  assertEquals(r.ok && r.plan.price_ht, 50847);
});

Deno.test("parseSellablePlan: absent, désactivé ou autre code → unavailable", () => {
  for (const row of [null, undefined, { ...GOLD_LIEU, is_active: false }, { ...GOLD_LIEU, code: "pro" }]) {
    const r = parseSellablePlan(row, "b2b_gold");
    assertEquals(r.ok ? "ok" : r.reason, "unavailable");
  }
});

Deno.test("parseSellablePlan: montant incertain → misconfigured (rien n'est vendu)", () => {
  for (const patch of [
    { tva_amount: 9152 }, // HT + TVA ≠ TTC
    { price_ttc: 0, price_ht: 0, tva_amount: 0 }, // gratuit : rien à encaisser
    { price_ttc: 59999.5 }, // pas un montant en francs
    { price_ttc: null }, // ligne d'avant 0079
    { price_ht: "50847.50" }, // HT non entier
    { tva_amount: -1, price_ht: 60001 },
  ]) {
    const r = parseSellablePlan({ ...GOLD_LIEU, ...patch }, "b2b_gold");
    assertEquals(r.ok ? "ok" : r.reason, "misconfigured", JSON.stringify(patch));
  }
});

Deno.test("parseSellablePlan: période différente de PLAN_PERIOD → misconfigured", () => {
  const annuel = parseSellablePlan({ ...GOLD_LIEU, period: "annual" }, "b2b_gold");
  assertEquals(annuel.ok ? "ok" : annuel.reason, "misconfigured");
  const goldAnnual = parseSellablePlan(
    { code: "gold_annual", period: "monthly", price_ttc: 29500, price_ht: 25000, tva_amount: 4500, is_active: true },
    "gold_annual",
  );
  assertEquals(goldAnnual.ok ? "ok" : goldAnnual.reason, "misconfigured");
});

function fakeReader(result: { data: unknown; error: { message: string } | null }) {
  const calls: unknown[][] = [];
  const reader: PlansReader = {
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          return {
            eq(column, value) {
              calls.push(["eq", column, value]);
              return {
                eq(column2, value2) {
                  calls.push(["eq", column2, value2]);
                  return { maybeSingle: () => Promise.resolve(result) };
                },
              };
            },
          };
        },
      };
    },
  };
  return { reader, calls };
}

Deno.test("loadSellablePlan: lit `plans` par code, plan actif seulement", async () => {
  const { reader, calls } = fakeReader({ data: GOLD_LIEU, error: null });
  const r = await loadSellablePlan(reader, "b2b_gold");
  assertEquals(r.ok && r.plan.price_ttc, 60000);
  assertEquals(calls, [
    ["from", "plans"],
    ["select", SELLABLE_PLAN_COLUMNS],
    ["eq", "code", "b2b_gold"],
    ["eq", "is_active", true],
  ]);
});

Deno.test("loadSellablePlan: lecture en erreur → db_error, aucune ligne → unavailable", async () => {
  const enErreur = await loadSellablePlan(fakeReader({ data: null, error: { message: "boom" } }).reader, "pro");
  assertEquals(enErreur.ok ? "ok" : enErreur.reason, "db_error");
  const absent = await loadSellablePlan(fakeReader({ data: null, error: null }).reader, "pro");
  assertEquals(absent.ok ? "ok" : absent.reason, "unavailable");
});

Deno.test("invoiceAmountsForSubscription: montants figés au checkout, jamais recalculés", () => {
  assertEquals(invoiceAmountsForSubscription({ price_ht: 50847, price_ttc: 60000, tva_rate: 18 }), {
    price_ht: 50847,
    tva_amount: 9153,
    price_ttc: 60000,
  });
  assertEquals(invoiceAmountsForSubscription({ price_ht: 59322, price_ttc: 70000, tva_rate: "18.00" }), {
    price_ht: 59322,
    tva_amount: 10678,
    price_ttc: 70000,
  });
});

Deno.test("invoiceAmountsForSubscription: abonnement d'avant 0079 → HT + TVA arrondie, ce qui a été encaissé", () => {
  assertEquals(invoiceAmountsForSubscription({ price_ht: 65000, price_ttc: null, tva_rate: 18 }), {
    price_ht: 65000,
    tva_amount: 11700,
    price_ttc: 76700,
  });
  assertEquals(invoiceAmountsForSubscription({ price_ht: 2500, price_ttc: undefined, tva_rate: "18.00" }), {
    price_ht: 2500,
    tva_amount: 450,
    price_ttc: 2950,
  });
});
