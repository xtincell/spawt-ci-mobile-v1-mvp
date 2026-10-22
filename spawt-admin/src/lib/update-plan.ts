// Tarifs (migration 0079) — changement du prix payé ou de l'activation d'un plan.
//
// `plans` est la seule source des prix : le checkout CinetPay, la validation
// manuelle et cette console la lisent. On y saisit le prix PAYÉ par le client
// (TTC, F CFA entiers) ; la base en dérive HT et TVA.
//
// Pourquoi une RPC et pas un PATCH : `plans` n'a AUCUNE policy d'écriture. Un
// PATCH « réussirait » (200) sans rien changer — le pire des cas pour une
// console d'exploitation. La RPC refuse franchement hors admin (42501), borne
// la saisie et journalise l'avant/après dans `admin_audit_log`.

import { supabaseClient } from "../utility/supabaseClient";

export interface UpdatedPlan {
  changed: boolean;
  code: string;
  price_ttc: number;
  price_ht: number;
  tva_amount: number;
  is_active: boolean;
  updated_at: string;
}

export interface UpdatePlanResult {
  ok: boolean;
  plan?: UpdatedPlan;
  error?: { code: string; message?: string };
}

export async function updatePlan(
  code: string,
  priceTtc: number,
  isActive: boolean,
  reason: string,
): Promise<UpdatePlanResult> {
  const { data, error } = await supabaseClient.rpc("admin_update_plan", {
    p_code: code,
    p_price_ttc: priceTtc,
    p_is_active: isActive,
    p_reason: reason,
  });
  if (error) {
    // 42501 = la garde `is_admin_staff()` a refusé. On le nomme, plutôt que de
    // renvoyer un « erreur inconnue » qui ferait chercher au mauvais endroit.
    const errCode = error.code === "42501" ? "FORBIDDEN" : (error.code ?? "RPC_FAILED");
    return { ok: false, error: { code: errCode, message: error.message } };
  }
  return { ok: true, plan: data as UpdatedPlan };
}
