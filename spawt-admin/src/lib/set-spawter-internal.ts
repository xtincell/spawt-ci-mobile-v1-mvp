// Comptes internes (migration 0060) — octroi/retrait du statut d'équipe.
//
// Le statut déverrouille le menu « Mode interne » dans les réglages de l'app :
// bascule entre l'expérience gratuite et l'expérience Spawter Gold, aperçu du
// paywall géographique. Il n'ouvre aucune donnée d'autrui et ne crée aucun
// droit facturé.
//
// Pourquoi une RPC et pas un simple PATCH sur `spawters` : un trigger serveur
// restaure la colonne dès que l'appelant n'est pas admin. Le PATCH « marcherait »
// en apparence (200, aucune erreur) et ne changerait rien — le pire des cas pour
// une console d'exploitation. La RPC, elle, refuse franchement (42501) et
// journalise l'octroi dans `admin_audit_log`.

import { supabaseClient } from "../utility/supabaseClient";

export interface SetInternalResult {
  ok: boolean;
  /** Valeur effective après l'appel (utile : la RPC est idempotente). */
  value?: boolean;
  error?: { code: string; message?: string };
}

export async function setSpawterInternal(
  spawter_id: string,
  enabled: boolean,
  reason?: string,
): Promise<SetInternalResult> {
  const { data, error } = await supabaseClient.rpc("set_spawter_internal", {
    p_spawter_id: spawter_id,
    p_enabled: enabled,
    p_reason: reason ?? null,
  });
  if (error) {
    // 42501 = la garde `is_admin_staff()` a refusé. On le nomme, plutôt que de
    // renvoyer un « erreur inconnue » qui ferait chercher au mauvais endroit.
    const code = error.code === "42501" ? "FORBIDDEN" : (error.code ?? "RPC_FAILED");
    return { ok: false, error: { code, message: error.message } };
  }
  return { ok: true, value: Boolean(data) };
}
