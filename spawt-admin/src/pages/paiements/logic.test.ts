import { describe, expect, it } from "vitest";
import {
  alertesAvantValidation,
  formatXof,
  indexerTarifs,
  libelleVerdict,
  verdictMontant,
  type PaymentRequestRow,
  type PlanTarif,
} from "./logic";

// Fixtures : la vraie valeur est celle de la table `plans` (page Tarifs).
const GOLD_MENSUEL: PlanTarif = { code: "gold_monthly", price_ttc: 2950, is_active: true };

const base: PaymentRequestRow = {
  id: "r1",
  requester_id: "s1",
  customer_type: "b2c",
  plan: "gold_monthly",
  method: "wave",
  amount_declare: 2950,
  reference: "TX1",
  payer_phone: "+2250700000000",
  note: null,
  status: "pending",
  decision_reason: null,
  decided_at: null,
  created_at: "2026-07-29T10:00:00Z",
};

describe("tarifs lus dans plans", () => {
  it("indexe les lignes plans par code et ignore les codes hors paiement", () => {
    const tarifs = indexerTarifs([
      { code: "b2b_gold", price_ttc: 60000, is_active: true },
      { code: "pro", price_ttc: 17700, is_active: false },
      { code: "lifetime_test", price_ttc: 1, is_active: true },
    ]);
    expect(tarifs).toEqual({
      b2b_gold: { code: "b2b_gold", price_ttc: 60000, is_active: true },
      pro: { code: "pro", price_ttc: 17700, is_active: false },
    });
  });

  it("compare au prix payé du plan, pas à un calcul HT + TVA", () => {
    // 60 000 n'est pas le TTC d'un HT entier (50 847 → 59 999) : seul le prix
    // payé lu dans plans donne « conforme ».
    const goldLieu: PlanTarif = { code: "b2b_gold", price_ttc: 60000, is_active: true };
    const r = { ...base, customer_type: "b2b" as const, plan: "b2b_gold" as const, amount_declare: 60000 };
    expect(verdictMontant(r, goldLieu)).toBe("exact");
    expect(verdictMontant({ ...r, amount_declare: 59999 }, goldLieu)).toBe("trop_peu");
  });

  it("sans tarif lu, le verdict le dit au lieu d'inventer un prix", () => {
    expect(verdictMontant(base, undefined)).toBe("tarif_inconnu");
    expect(libelleVerdict(base, undefined)).toBe("tarif introuvable dans Tarifs");
  });
});

describe("verdict sur le montant déclaré", () => {
  it("reconnaît un montant conforme", () => {
    expect(verdictMontant(base, GOLD_MENSUEL)).toBe("exact");
  });

  it("signale un sous-paiement — le cas qui coûte de l'argent", () => {
    // Le serveur facturera 2 500 HT quoi qu'il arrive : valider ici, c'est
    // offrir un mois. C'est exactement ce qu'on veut voir en rouge.
    const r = { ...base, amount_declare: 500 };
    expect(verdictMontant(r, GOLD_MENSUEL)).toBe("trop_peu");
    expect(libelleVerdict(r, GOLD_MENSUEL)).toContain("2450 F de moins");
  });

  it("signale un surpaiement sans le traiter comme une erreur", () => {
    expect(verdictMontant({ ...base, amount_declare: 3000 }, GOLD_MENSUEL)).toBe("trop");
  });

  it("traite un montant nul ou absurde comme illisible", () => {
    expect(verdictMontant({ ...base, amount_declare: 0 }, GOLD_MENSUEL)).toBe("inconnu");
    expect(verdictMontant({ ...base, amount_declare: Number.NaN }, GOLD_MENSUEL)).toBe("inconnu");
  });
});

describe("alertes avant validation", () => {
  it("ne dit rien quand tout est en ordre", () => {
    expect(alertesAvantValidation(base, GOLD_MENSUEL)).toEqual([]);
  });

  it("alerte sur un versement introuvable (ni référence ni numéro)", () => {
    const r = { ...base, reference: "  ", payer_phone: null };
    expect(alertesAvantValidation(r, GOLD_MENSUEL)).toHaveLength(1);
    expect(alertesAvantValidation(r, GOLD_MENSUEL)[0]).toContain("introuvable");
  });

  it("n'exige pas de référence pour des espèces en main propre", () => {
    const r: PaymentRequestRow = {
      ...base,
      method: "especes",
      reference: null,
      payer_phone: null,
    };
    expect(alertesAvantValidation(r, GOLD_MENSUEL)).toEqual([]);
  });

  it("prévient qu'un plan désactivé ou absent de Tarifs sera refusé", () => {
    const desactive: PlanTarif = { ...GOLD_MENSUEL, is_active: false };
    expect(alertesAvantValidation(base, desactive)[0]).toContain("désactivé");
    expect(alertesAvantValidation(base, undefined)[0]).toContain("absent de la page Tarifs");
  });

  it("cumule les alertes : sous-paiement ET versement introuvable", () => {
    const r = { ...base, amount_declare: 100, reference: null, payer_phone: null };
    expect(alertesAvantValidation(r, GOLD_MENSUEL)).toHaveLength(2);
  });
});

describe("formatage", () => {
  // Assertions écrites avec l'échappement explicite : une espace insécable
  // copiée-collée dans un test est invisible et indébuggable.
  it("sépare les milliers par une espace insécable, la même partout", () => {
    expect(formatXof(29500)).toBe("29\u00A0500\u00A0F");
    expect(formatXof(2950)).toBe("2\u00A0950\u00A0F");
    expect(formatXof(950)).toBe("950\u00A0F");
    expect(formatXof(1000000)).toBe("1\u00A0000\u00A0000\u00A0F");
  });
});
