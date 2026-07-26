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
// ⚠️ Déploiement : cette fonction doit être déployée avec `--no-verify-jwt`
// (CinetPay n'envoie pas de JWT Supabase).
//
// Secrets : CINETPAY_* + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injectés).

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { isGoldPlan } from "../_shared/payment/types.ts";
import { createPaymentProvider, PaymentConfigError } from "../_shared/payment/factory.ts";
import { computeExpiresAt } from "../_shared/payment/subscription-lifecycle.ts";

// @ts-expect-error — Deno global
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
      return out;
    }
    if (contentType.includes("form")) {
      const form = await req.formData();
      const out: Record<string, string> = {};
      for (const [k, v] of form.entries()) {
        out[k] = typeof v === "string" ? v : "";
      }
      return out;
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
    .select("id, customer_id, customer_type, plan, price_ht, tva_rate, currency, status")
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
    const startedAt = new Date();
    if (!isGoldPlan(sub.plan)) {
      // Plan hors périmètre B2C (pro / b2b_gold) : pas d'échéance auto ici.
      logTransition({ transaction_id: txId, decision: "ignored_non_gold_plan", plan: sub.plan });
      return json({ received: true, ignored: "non_gold_plan" });
    }
    const expiresAt = computeExpiresAt(sub.plan, startedAt);

    // Activation — garde .neq('status','active') : deux notifications
    // concurrentes ne peuvent pas activer deux fois (la 2e ne matche plus).
    const { data: updated, error: updErr } = await admin
      .from("subscriptions")
      .update({
        status: "active",
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        grace_until: null,
      })
      .eq("id", sub.id)
      .neq("status", "active")
      .select("id");
    if (updErr) {
      logTransition({ transaction_id: txId, decision: "db_error_activate", detail: updErr.message });
      return json({ error: "db_error" }, 500);
    }
    if (!updated || updated.length === 0) {
      // Course perdue contre une notification jumelle : elle a déjà activé.
      logTransition({ transaction_id: txId, decision: "noop_concurrent_activation" });
      return json({ received: true, idempotent: true });
    }

    // Renouvellement depuis la grâce : l'ancien abonnement en grâce du même
    // customer est clos (supersédé par le nouveau — un seul droit actif).
    const { error: superErr } = await admin
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("customer_id", sub.customer_id)
      .eq("status", "grace")
      .neq("id", sub.id);
    if (superErr) {
      logTransition({ transaction_id: txId, decision: "warn_supersede_failed", detail: superErr.message });
    }

    // Facture payée — mécanique 0032 : le trigger BEFORE INSERT pose
    // invoice_number (next_invoice_number, SPAWT-YYYY-NNNN), tva_amount et
    // price_ttc quand on ne les fournit pas. Garde anti-doublon : une facture
    // existe déjà pour ce provider_tx_id → skip (webhook rejoué).
    const { data: existingInvoice, error: invCheckErr } = await admin
      .from("invoices")
      .select("id")
      .eq("provider_tx_id", txId)
      .maybeSingle();
    if (invCheckErr) {
      logTransition({ transaction_id: txId, decision: "warn_invoice_check_failed", detail: invCheckErr.message });
    }
    if (!existingInvoice) {
      const { error: invErr } = await admin.from("invoices").insert({
        subscription_id: sub.id,
        customer_id: sub.customer_id,
        customer_type: sub.customer_type,
        price_ht: sub.price_ht,
        tva_rate: sub.tva_rate,
        currency: sub.currency,
        status: "paid",
        provider_tx_id: txId,
        issued_at: startedAt.toISOString(),
        paid_at: confirmation.paidAt ?? startedAt.toISOString(),
      });
      if (invErr) {
        // La facture a raté mais le droit est actif : on log fort (rattrapage
        // manuel/admin), on ne casse pas le 200 — CinetPay n'y peut rien.
        logTransition({ transaction_id: txId, decision: "error_invoice_insert", detail: invErr.message });
      }
    }

    logTransition({
      transaction_id: txId,
      decision: "activated",
      plan: sub.plan,
      expires_at: expiresAt.toISOString(),
      payment_method: confirmation.paymentMethod,
    });
    return json({ received: true, status: "active" });
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
