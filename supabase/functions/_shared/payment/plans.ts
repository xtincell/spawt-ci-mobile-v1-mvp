// Prix : la table `plans`, seule source (migration 0079).
//
// L'équipe saisit le prix payé (TTC, F CFA entiers) dans la console, page
// Tarifs ; la base en dérive HT = round(TTC / 1,18) et TVA = TTC − HT. Les
// Edge Functions ne connaissent aucun montant : le checkout lit ici le plan
// qu'il vend, le webhook facture ce que le checkout a figé sur l'abonnement.
//
// Règle : montant facturé = montant encaissé. Un tarif peut changer entre
// l'ouverture du paiement et sa confirmation ; la facture reprend donc le TTC
// figé au checkout, jamais le prix courant.

import { computeTtc, isPlanPeriod, PLAN_PERIOD, type PaidPlan, type PlanPeriod } from "./types.ts";

/** Une ligne `plans` vendable : active, montants entiers et cohérents. */
export interface SellablePlan {
  code: PaidPlan;
  period: PlanPeriod;
  /** Prix payé, TTC — le montant envoyé au provider. */
  price_ttc: number;
  price_ht: number;
  tva_amount: number;
}

export type SellablePlanResult =
  | { ok: true; plan: SellablePlan }
  // db_error : lecture impossible ; unavailable : plan absent ou désactivé ;
  // misconfigured : ligne incohérente. Les trois ferment la vente.
  | { ok: false; reason: "db_error" | "unavailable" | "misconfigured"; detail?: string };

/** Colonnes lues par le checkout. */
export const SELLABLE_PLAN_COLUMNS = "code, period, price_ttc, price_ht, tva_amount, is_active";

function toWholeNumber(value: unknown): number | null {
  // `price_ht` est un numeric(12,2) : PostgREST le rend en nombre, parfois en
  // texte selon la configuration. Seul un entier est un montant valable.
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
}

/**
 * Valide une ligne lue dans `plans`. Pure : testable sans base.
 * Refuse tout ce qui ferait facturer un montant incertain — prix non entier
 * ou nul, HT + TVA ≠ TTC, période différente de celle du code.
 */
export function parseSellablePlan(row: unknown, code: PaidPlan): SellablePlanResult {
  if (!row || typeof row !== "object") return { ok: false, reason: "unavailable" };
  const r = row as Record<string, unknown>;
  if (r.code !== code || r.is_active !== true) return { ok: false, reason: "unavailable" };

  const ttc = toWholeNumber(r.price_ttc);
  const ht = toWholeNumber(r.price_ht);
  const tva = toWholeNumber(r.tva_amount);
  if (ttc === null || ht === null || tva === null || ttc <= 0 || ht <= 0 || tva < 0 || ht + tva !== ttc) {
    return { ok: false, reason: "misconfigured", detail: `montants incohérents pour ${code}` };
  }
  if (!isPlanPeriod(r.period) || r.period !== PLAN_PERIOD[code]) {
    return { ok: false, reason: "misconfigured", detail: `période inattendue pour ${code}` };
  }
  return { ok: true, plan: { code, period: r.period, price_ttc: ttc, price_ht: ht, tva_amount: tva } };
}

/** Le strict nécessaire du client supabase-js (service role) pour lire un plan. */
export interface PlansReader {
  from(table: "plans"): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
}

/** Lit le plan vendu : actif seulement. Toute anomalie ferme la vente. */
export async function loadSellablePlan(
  client: PlansReader,
  code: PaidPlan,
): Promise<SellablePlanResult> {
  const { data, error } = await client
    .from("plans")
    .select(SELLABLE_PLAN_COLUMNS)
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", detail: error.message };
  return parseSellablePlan(data, code);
}

/** Montants d'une facture, toujours explicites (le trigger 0032 n'a rien à calculer). */
export interface InvoiceAmounts {
  price_ht: number;
  tva_amount: number;
  price_ttc: number;
}

/**
 * Montants de la facture d'un abonnement payé : ceux FIGÉS sur l'abonnement
 * au checkout. `price_ttc` NULL = abonnement ouvert avant 0079 : le checkout
 * d'alors demandait HT + TVA arrondie, c'est donc ce qui a été encaissé.
 */
export function invoiceAmountsForSubscription(sub: {
  price_ht: number;
  price_ttc: number | null | undefined;
  tva_rate: number | string;
}): InvoiceAmounts {
  if (sub.price_ttc !== null && sub.price_ttc !== undefined) {
    return {
      price_ht: sub.price_ht,
      tva_amount: sub.price_ttc - sub.price_ht,
      price_ttc: sub.price_ttc,
    };
  }
  const ttc = computeTtc(sub.price_ht, Number(sub.tva_rate));
  return { price_ht: sub.price_ht, tva_amount: ttc - sub.price_ht, price_ttc: ttc };
}
