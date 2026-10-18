// Page Tarifs (0079) — tests de la logique pure. Les montants sont des
// fixtures : la vraie valeur est celle de la table `plans`.

import { describe, expect, it } from "vitest";
import {
  changeSummary,
  deriveAmounts,
  describeAudit,
  hasChanges,
  lastChangeByPlan,
  parsePriceInput,
  periodLabel,
  updatePlanErrorMessage,
  type PlanAuditRow,
  type PlanRow,
} from "./logic";

const GOLD_LIEU: PlanRow = {
  id: "p-gold-lieu",
  code: "b2b_gold",
  label: "Spawt Gold — lieu",
  period: "monthly",
  price_ttc: 60000,
  price_ht: 50847,
  tva_amount: 9153,
  is_active: true,
  updated_at: "2026-10-18T10:00:00Z",
};

describe("deriveAmounts — aperçu de la dérivation faite par la base", () => {
  it("Gold lieu : 60 000 payés = 50 847 HT + 9 153 de TVA", () => {
    expect(deriveAmounts(60000)).toEqual({ price_ht: 50847, tva_amount: 9153 });
  });

  it("retrouve les HT d'avant 0079 pour les prix inchangés", () => {
    expect(deriveAmounts(2950)).toEqual({ price_ht: 2500, tva_amount: 450 });
    expect(deriveAmounts(29500)).toEqual({ price_ht: 25000, tva_amount: 4500 });
    expect(deriveAmounts(17700)).toEqual({ price_ht: 15000, tva_amount: 2700 });
  });

  it("arrondit comme PostgreSQL, round(TTC / 1,18), sur 1 à 1 000 000 F", () => {
    // Référence en entiers exacts : arrondi à l'entier le plus proche de
    // 100·TTC / 118, demi vers le haut (round de PostgreSQL sur numeric).
    for (let ttc = 1; ttc <= 1_000_000; ttc += 1) {
      const exact = Math.floor((200 * ttc + 118) / 236);
      const { price_ht, tva_amount } = deriveAmounts(ttc);
      if (price_ht !== exact || price_ht + tva_amount !== ttc) {
        throw new Error(`écart à ${ttc} F : ${price_ht} au lieu de ${exact}`);
      }
    }
  });
});

describe("parsePriceInput — la saisie du prix payé", () => {
  it("accepte les écritures usuelles d'un montant en F CFA", () => {
    expect(parsePriceInput("60000")).toEqual({ ok: true, value: 60000 });
    expect(parsePriceInput("60 000")).toEqual({ ok: true, value: 60000 });
    expect(parsePriceInput("60\u00A0000")).toEqual({ ok: true, value: 60000 });
    expect(parsePriceInput("60\u202F000 F")).toEqual({ ok: true, value: 60000 });
    expect(parsePriceInput(" 60 000 F CFA ")).toEqual({ ok: true, value: 60000 });
  });

  it("refuse ce qui n'est pas un entier positif", () => {
    for (const raw of ["", "  ", "0", "-100", "60000,5", "60.000", "abc", "1e5"]) {
      expect(parsePriceInput(raw).ok, raw).toBe(false);
    }
  });
});

describe("changeSummary — l'avant/après de la confirmation", () => {
  it("montre le prix payé avant → après avec HT et TVA dérivés", () => {
    const lines = changeSummary(GOLD_LIEU, 55050, true);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("Prix payé : 60\u00A0000\u00A0F → 55\u00A0050\u00A0F (HT 46\u00A0653\u00A0F + TVA 8\u00A0397\u00A0F)");
  });

  it("signale un facteur 2 ou plus — la signature d'un zéro de trop ou en moins", () => {
    expect(changeSummary(GOLD_LIEU, 600000, true).some((l) => l.includes("facteur 2"))).toBe(true);
    expect(changeSummary(GOLD_LIEU, 6000, true).some((l) => l.includes("facteur 2"))).toBe(true);
    expect(changeSummary(GOLD_LIEU, 65000, true).some((l) => l.includes("facteur 2"))).toBe(false);
  });

  it("dit ce qu'implique une désactivation, sans ligne de prix si le prix ne bouge pas", () => {
    expect(changeSummary(GOLD_LIEU, 60000, false)).toEqual([
      "Statut : actif → désactivé (plus de checkout ni de validation manuelle pour ce plan).",
    ]);
  });

  it("hasChanges ne voit un changement que sur le prix ou le statut", () => {
    expect(hasChanges(GOLD_LIEU, 60000, true)).toBe(false);
    expect(hasChanges(GOLD_LIEU, 60001, true)).toBe(true);
    expect(hasChanges(GOLD_LIEU, 60000, false)).toBe(true);
  });
});

describe("journal — le dernier changement de chaque plan", () => {
  const migration: PlanAuditRow = {
    entity_id: "p-gold-lieu",
    created_at: "2026-10-18T09:00:00Z",
    reason: "Migration 0079 : prix payé d'abord (décision du 18/10/2026)",
    spawt_staff_id: null,
    payload_before: { price_ttc: 76700, is_active: true },
    payload_after: { price_ttc: 60000, is_active: true },
  };
  const admin: PlanAuditRow = {
    entity_id: "p-gold-lieu",
    created_at: "2026-10-20T09:00:00Z",
    reason: "pause commerciale",
    spawt_staff_id: "s-admin",
    payload_before: { price_ttc: 60000, is_active: true },
    payload_after: { price_ttc: 60000, is_active: false },
    spawt_staff: { display_name: "Alexandre" },
  };

  it("retient la ligne la plus récente par plan, quel que soit l'ordre reçu", () => {
    expect(lastChangeByPlan([migration, admin])["p-gold-lieu"]).toBe(admin);
    expect(lastChangeByPlan([admin, migration])["p-gold-lieu"]).toBe(admin);
  });

  it("décrit une ligne de migration (sans auteur) et une ligne d'admin", () => {
    expect(describeAudit(migration)).toContain("Migration");
    expect(describeAudit(migration)).toContain("76\u00A0700\u00A0F → 60\u00A0000\u00A0F");
    expect(describeAudit(admin)).toContain("Alexandre");
    expect(describeAudit(admin)).toContain("désactivé");
    expect(describeAudit(admin)).toContain("« pause commerciale »");
  });

  it("lit l'auteur que PostgREST le rende en objet ou en tableau", () => {
    expect(describeAudit({ ...admin, spawt_staff: [{ display_name: "Kidam" }] })).toContain("Kidam");
    expect(describeAudit({ ...admin, spawt_staff: null })).toContain("Équipe");
  });
});

describe("libellés et erreurs", () => {
  it("nomme les périodes", () => {
    expect(periodLabel("monthly")).toBe("Mensuel");
    expect(periodLabel("annual")).toBe("Annuel");
    expect(periodLabel("trimestriel")).toBe("trimestriel");
  });

  it("nomme le refus hors admin et relaie les refus de saisie de la RPC", () => {
    expect(updatePlanErrorMessage({ code: "FORBIDDEN" })).toBe(
      "Refusé : seul un admin actif peut modifier un tarif.",
    );
    expect(
      updatePlanErrorMessage({ code: "23514", message: "prix payé invalide : entier de 1 à 1 000 000 F CFA" }),
    ).toBe("Refusé : prix payé invalide : entier de 1 à 1 000 000 F CFA.");
    expect(updatePlanErrorMessage({ code: "P0002" })).toContain("n'existe plus");
    expect(updatePlanErrorMessage({ code: "XX000", message: "boom" })).toBe("Erreur : boom");
  });
});
