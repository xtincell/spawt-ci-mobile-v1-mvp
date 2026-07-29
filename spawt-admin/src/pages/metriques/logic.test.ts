// Console admin 07/2026 — tests logique pure KPIs AARRR (PRD §16).

import { describe, it, expect } from "vitest";
import {
  computeMrr,
  countGoldActive,
  dailyAverage,
  distinctCount,
  isSubscriptionActive,
  lastNDays,
  planPeriodMonths,
  type SubscriptionLite,
} from "./logic";

const NOW = new Date("2026-07-26T12:00:00Z");

function sub(partial: Partial<SubscriptionLite>): SubscriptionLite {
  return {
    plan: "gold_monthly",
    status: "active",
    price_ht: 2500,
    customer_type: "b2c",
    expires_at: "2026-08-15T00:00:00Z",
    grace_until: null,
    ...partial,
  };
}

describe("distinctCount (MAU)", () => {
  it("compte les spawters distincts, pas les spawts", () => {
    expect(
      distinctCount([{ spawter_id: "a" }, { spawter_id: "a" }, { spawter_id: "b" }]),
    ).toBe(2);
    expect(distinctCount([])).toBe(0);
  });
});

describe("lastNDays / dailyAverage (fenêtre 7j glissante)", () => {
  const series = [
    { date: "2026-07-18", count: 100 }, // hors fenêtre 7j
    { date: "2026-07-20", count: 7 },
    { date: "2026-07-25", count: 14 },
  ];

  it("lastNDays garde la fenêtre incluant aujourd'hui", () => {
    expect(lastNDays(series, 7, NOW).map((p) => p.date)).toEqual(["2026-07-20", "2026-07-25"]);
  });

  it("dailyAverage divise par n (jours creux = 0) et arrondit à 0.1", () => {
    expect(dailyAverage(series, 7, NOW)).toBe(3); // (7+14)/7 = 3.0
    expect(dailyAverage([], 7, NOW)).toBe(0);
  });
});

describe("isSubscriptionActive (miroir vue active_entitlements 0032)", () => {
  it("active avec échéance future / sans échéance", () => {
    expect(isSubscriptionActive(sub({}), NOW)).toBe(true);
    expect(isSubscriptionActive(sub({ expires_at: null }), NOW)).toBe(true);
  });

  it("expirée mais fenêtre de grâce ouverte = encore active", () => {
    expect(
      isSubscriptionActive(
        sub({ status: "grace", expires_at: "2026-07-20T00:00:00Z", grace_until: "2026-07-30T00:00:00Z" }),
        NOW,
      ),
    ).toBe(true);
  });

  it("expirée sans grâce, ou statut hors active/grace = inactive", () => {
    expect(isSubscriptionActive(sub({ expires_at: "2026-07-20T00:00:00Z" }), NOW)).toBe(false);
    expect(isSubscriptionActive(sub({ status: "cancelled" }), NOW)).toBe(false);
    expect(isSubscriptionActive(sub({ status: "pending" }), NOW)).toBe(false);
  });
});

describe("MRR + Gold actifs (PRD §16)", () => {
  const subs = [
    sub({ price_ht: 2500 }),                                             // gold b2c actif
    sub({ plan: "gold_annual", price_ht: 25000 }),                       // gold b2c actif
    sub({ plan: "b2b_gold", customer_type: "b2b", price_ht: 15000 }),    // b2b actif
    sub({ status: "cancelled", price_ht: 99999 }),                       // ignoré
    sub({ expires_at: "2026-07-01T00:00:00Z", price_ht: 88888 }),        // expiré, ignoré
  ];

  it("MRR mensuel : les annuels sont normalisés /12 (finding P2#9)", () => {
    // gold_monthly 2500 + gold_annual 25000/12 + b2b_gold 15000.
    expect(computeMrr(subs, NOW)).toBe(Math.round(2500 + 25000 / 12 + 15000));
  });

  it("planPeriodMonths : gold_annual = 12, autres = 1", () => {
    expect(planPeriodMonths("gold_annual")).toBe(12);
    expect(planPeriodMonths("gold_monthly")).toBe(1);
    expect(planPeriodMonths("pro")).toBe(1);
    expect(planPeriodMonths("b2b_gold")).toBe(1);
  });

  it("un abonné annuel seul ne gonfle pas le MRR (25000/an → ~2083/mois)", () => {
    expect(computeMrr([sub({ plan: "gold_annual", price_ht: 25000 })], NOW)).toBe(
      Math.round(25000 / 12),
    );
  });

  it("Gold actifs = abonnés b2c gold uniquement (pas les comptes b2b)", () => {
    expect(countGoldActive(subs, NOW)).toBe(2);
  });
});
