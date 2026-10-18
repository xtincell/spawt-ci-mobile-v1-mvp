// Edge Function `payment-webhook` — notification CinetPay (Sprint 2, PRD §13.8).
// Runtime : Deno (Supabase Edge).
//
// ENDPOINT PUBLIC : c'est CinetPay qui appelle (notify_url posée au checkout),
// PAS un spawter — aucune auth Bearer ici. La sécurité repose sur :
//   1. la signature HMAC `x-token` (CINETPAY_SECRET_KEY, cf. cinetpay.ts) ;
//   2. la RÈGLE D'OR : le webhook ne fait JAMAIS foi seul — toute activation
//      est re-confirmée par un appel server-to-server /v2/payment/check
//      (provider.getStatus) AVANT d'écrire quoi que ce soit en base.
// Même si le format HMAC de CinetPay évoluait, un attaquant ne peut donc pas
// activer un abonnement : il faudrait aussi que CinetPay confirme ACCEPTED.
//
// Politique de réponse (anti retry-storm) :
//   200 → message compris (succès, échec paiement, transaction inconnue,
//         replay idempotent) — CinetPay ne re-notifie pas.
//   400 → signature invalide ou payload illisible.
//   405 → méthode ≠ POST.
//
// Plans couverts : B2C (gold_monthly / gold_annual) ET B2B lieux (pro /
// b2b_gold). À l'activation d'un plan B2B, le rôle b2b_accounts du compte
// payeur est synchronisé (pro→'pro', b2b_gold→'gold') ; à l'expiration le
// rôle n'est JAMAIS rétrogradé automatiquement — acte humain (voir plus bas).
//
// ⚠️ Déploiement : cette fonction doit être déployée avec `--no-verify-jwt`
// (CinetPay n'envoie pas de JWT Supabase).
//
// Secrets : CINETPAY_* + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injectés).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { isPaidPlan } from "../_shared/payment/types.ts";
import { invoiceAmountsForSubscription } from "../_shared/payment/plans.ts";
import { createPaymentProvider, PaymentConfigError } from "../_shared/payment/factory.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Promise<Response> | Response) => void;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * États d'une subscription depuis lesquels une confirmation `accepted` PEUT
 * activer (finding P1#5). getStatus répond `accepted` à vie : sans ce garde, une
 * re-notification signée d'une vieille transaction réactiverait gratuitement une
 * sub passée 'expired'/'grace' par le cron (répétable). 'active' est déjà traité
 * en amont (idempotence). Un vrai renouvellement crée une NOUVELLE sub 'pending'.
 */
export const ACTIVATABLE_STATUSES = ["pending", "cancelled"] as const;
export function isActivatableStatus(status: string): boolean {
  return (ACTIVATABLE_STATUSES as readonly string[]).includes(status);
}

/** Log structuré de transition — chaque décision du webhook laisse une trace. */
function logTransition(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ evt: "payment_webhook", ...fields }));
}

/**
 * CinetPay notifie en `application/x-www-form-urlencoded` (champs cpm_*) ;
 * on tolère aussi JSON et multipart pour rester robuste aux évolutions.
 * Retourne null si le corps est illisible.
 */
export async function readWebhookFields(req: Request): Promise<Record<string, string> | null> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (contentType.includes("application/json")) {
      const parsed = (await req.json()) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k] = v == null ? "" : String(v);
      }
      return Object.keys(out).length > 0 ? out : null;
    }
    if (contentType.includes("form")) {
      const form = await req.formData();
      const out: Record<string, string> = {};
      for (const [k, v] of form.entries()) {
        out[k] = typeof v === "string" ? v : "";
      }
      return Object.keys(out).length > 0 ? out : null;
    }
    // Fallback : tenter urlencoded brut.
    const text = await req.text();
    if (!text) return null;
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    for (const [k, v] of params.entries()) out[k] = v;
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return json({ error: "edge_misconfigured" }, 500);
  }

  let provider;
  try {
    provider = createPaymentProvider();
  } catch (err) {
    if (err instanceof PaymentConfigError) return json({ error: "edge_misconfigured" }, 500);
    throw err;
  }

  const fields = await readWebhookFields(req);
  if (!fields) return json({ error: "invalid_payload" }, 400);

  // ── 1. Authentification du message : signature HMAC x-token ──────────────
  const event = await provider.parseWebhook(req.headers, fields);
  if (!event.signatureValid) {
    logTransition({ decision: "rejected_invalid_signature" });
    return json({ error: "invalid_signature" }, 400);
  }
  if (!event.transactionId) {
    logTransition({ decision: "ignored_no_transaction_id" });
    return json({ received: true, ignored: "no_transaction_id" });
  }
  const txId = event.transactionId;

  const admin = createClient(supabaseUrl, serviceRole);

  // ── 2. Résolution de la subscription (provider_tx_id = idempotence 0032) ──
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, customer_id, customer_type, plan, price_ht, price_ttc, tva_rate, currency, status")
    .eq("provider_tx_id", txId)
    .maybeSingle();
  if (subErr) {
    logTransition({ transaction_id: txId, decision: "db_error", detail: subErr.message });
    return json({ error: "db_error" }, 500);
  }
  if (!sub) {
    // Transaction inconnue chez nous : compris mais non traitable → 200
    // (pas de retry storm) + trace pour investigation.
    logTransition({ transaction_id: txId, decision: "ignored_unknown_transaction" });
    return json({ received: true, ignored: "unknown_transaction" });
  }

  // ── 3. Idempotence : une transaction déjà activée re-notifiée = no-op ─────
  if (sub.status === "active") {
    logTransition({ transaction_id: txId, decision: "noop_already_active" });
    return json({ received: true, idempotent: true });
  }

  // ── 4. RÈGLE D'OR : re-confirmation server-to-server avant toute écriture ─
  let confirmation;
  try {
    confirmation = await provider.getStatus(txId);
  } catch (err) {
    // Check indisponible : on ne décide RIEN. 500 → CinetPay re-notifiera,
    // et le polling portail / cron rattrape de toute façon.
    logTransition({
      transaction_id: txId,
      decision: "recheck_unavailable",
      detail: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "provider_recheck_failed" }, 500);
  }

  logTransition({
    transaction_id: txId,
    announced: event.announcedStatus,
    confirmed: confirmation.status,
    from_status: sub.status,
  });

  if (confirmation.status === "accepted") {
    // ── Anti-réactivation (finding P1#5) ──────────────────────────────────
    // N'activer QUE depuis un état INITIAL de paiement. getStatus répond
    // `accepted` À VIE pour une transaction acceptée : une re-notification
    // signée d'une vieille transaction ne doit JAMAIS ressusciter une sub que
    // le cron a passée en 'expired' ou 'grace' — ce serait un Gold gratuit,
    // répétable. Un vrai renouvellement crée une NOUVELLE sub 'pending'
    // (nouveau tx_id), il n'emprunte pas ce chemin. 'active' est déjà court-
    // circuité plus haut (idempotence). La vérification du statut dans la transaction
    // de la RPC sous verrou ferme la fenêtre TOCTOU (fetch → update).
    if (!isActivatableStatus(sub.status)) {
      logTransition({ transaction_id: txId, decision: "noop_terminal_status", from_status: sub.status });
      return json({ received: true, idempotent: true });
    }
    if (!isPaidPlan(sub.plan)) {
      logTransition({ transaction_id: txId, decision: "ignored_unknown_plan", plan: sub.plan });
      return json({ received: true, ignored: "unknown_plan" });
    }
    const amounts = invoiceAmountsForSubscription(sub);
    if (!Number.isSafeInteger(confirmation.amount) || confirmation.amount <= 0
      || confirmation.amount !== amounts.price_ttc || confirmation.currency !== sub.currency
      || sub.currency !== "XOF") {
      logTransition({ transaction_id: txId, decision: "rejected_payment_mismatch",
        expected_amount: amounts.price_ttc, confirmed_amount: confirmation.amount,
        expected_currency: sub.currency, confirmed_currency: confirmation.currency });
      return json({ received: true, ignored: "payment_mismatch" });
    }

    // The database repeats the checks against the locked subscription and commits
    // activation, invoice, grace closure and B2B role in one transaction. A failed
    // write leaves the payment pending, so a retry can complete it safely.
    const { data: applied, error: applyError } = await admin.rpc("confirm_provider_payment", {
      p_transaction_id: txId,
      p_provider: provider.name,
      p_amount: confirmation.amount,
      p_currency: confirmation.currency,
      p_paid_at: confirmation.paidAt,
    });
    if (applyError || !applied) {
      logTransition({ transaction_id: txId, decision: "db_error_confirmation", detail: applyError?.message });
      return json({ error: "db_error" }, 500);
    }
    logTransition({ transaction_id: txId,
      decision: applied.status === "active" ? "activated" : applied.ignored ?? "idempotent",
      plan: sub.plan, expires_at: applied.expires_at ?? null, payment_method: confirmation.paymentMethod });
    return json(applied);
  }

  if (confirmation.status === "refused") {
    // Schéma 0032 : pas de statut 'failed' — l'échec laisse la subscription
    // en 'pending' (le spawter peut relancer un checkout, nouveau tx_id).
    // Trace structurée pour le suivi des échecs (SPEC 4 §4.6).
    logTransition({ transaction_id: txId, decision: "payment_refused", stays: sub.status });
    return json({ received: true, status: "refused" });
  }

  // pending / en attente de validation Mobile Money : rien à écrire.
  logTransition({ transaction_id: txId, decision: "still_pending" });
  return json({ received: true, status: "pending" });
}

Deno.serve(handleRequest);
