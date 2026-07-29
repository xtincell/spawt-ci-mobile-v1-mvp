import { describe, expect, it } from "vitest";
import {
  alertesAvantValidation,
  expectedTtc,
  formatXof,
  libelleVerdict,
  verdictMontant,
  type PaymentRequestRow,
} from "./logic";

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

describe("tarifs", () => {
  it("TTC = HT + 18 %, en francs entiers", () => {
    expect(expectedTtc("gold_monthly")).toBe(2950);
    expect(expectedTtc("gold_annual")).toBe(29500);
    expect(expectedTtc("pro")).toBe(17700);
    expect(expectedTtc("b2b_gold")).toBe(76700);
  });
});

describe("verdict sur le montant déclaré", () => {
  it("reconnaît un montant conforme", () => {
    expect(verdictMontant(base)).toBe("exact");
  });

  it("signale un sous-paiement — le cas qui coûte de l'argent", () => {
    // Le serveur facturera 2 500 HT quoi qu'il arrive : valider ici, c'est
    // offrir un mois. C'est exactement ce qu'on veut voir en rouge.
    const r = { ...base, amount_declare: 500 };
    expect(verdictMontant(r)).toBe("trop_peu");
    expect(libelleVerdict(r)).toContain("2450 F de moins");
  });

  it("signale un surpaiement sans le traiter comme une erreur", () => {
    expect(verdictMontant({ ...base, amount_declare: 3000 })).toBe("trop");
  });

  it("traite un montant nul ou absurde comme illisible", () => {
    expect(verdictMontant({ ...base, amount_declare: 0 })).toBe("inconnu");
    expect(verdictMontant({ ...base, amount_declare: Number.NaN })).toBe("inconnu");
  });
});

describe("alertes avant validation", () => {
  it("ne dit rien quand tout est en ordre", () => {
    expect(alertesAvantValidation(base)).toEqual([]);
  });

  it("alerte sur un versement introuvable (ni référence ni numéro)", () => {
    const r = { ...base, reference: "  ", payer_phone: null };
    expect(alertesAvantValidation(r)).toHaveLength(1);
    expect(alertesAvantValidation(r)[0]).toContain("introuvable");
  });

  it("n'exige pas de référence pour des espèces en main propre", () => {
    const r: PaymentRequestRow = {
      ...base,
      method: "especes",
      reference: null,
      payer_phone: null,
    };
    expect(alertesAvantValidation(r)).toEqual([]);
  });

  it("cumule les alertes : sous-paiement ET versement introuvable", () => {
    const r = { ...base, amount_declare: 100, reference: null, payer_phone: null };
    expect(alertesAvantValidation(r)).toHaveLength(2);
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
