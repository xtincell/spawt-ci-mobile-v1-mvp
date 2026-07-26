// Edge Function `payment-checkout` — Sprint 2 monétisation (PRD §13.8).
// Runtime : Deno (Supabase Edge).
//
// Modèle Spotify/Netflix : l'ACHAT se fait sur le portail web (spawt.online),
// jamais dans l'app (conformité Apple 3.1.3). Cette fonction est appelée par
// le portail avec le Bearer access_token du spawter connecté.
//
// Contrat (aligné sur project_spawt_mobile_ci/src/lib/api.ts) :
//   POST /functions/v1/payment-checkout
//   Headers : Authorization: Bearer <access_token spawter> · apikey: <anon>
//   Body    : {"plan":"gold_monthly"|"gold_annual","return_url"?:"https://…"}
//   200 → {"payment_url":"https://…","transaction_id":"SPAWT-TX-…"}
//   400 → {"error":"invalid_json"|"invalid_plan"|"invalid_return_url"}
//   401 → {"error":"invalid_token"} (session expirée → relogin portail)
//   409 → {"error":"already_active"} (entitlement Gold déjà actif)
//   502 → {"error":"provider_error"} (CinetPay indisponible)
//   500 → {"error":"edge_misconfigured"|"db_error"}
//
// Secrets attendus côté Supabase Edge env :
//   CINETPAY_API_KEY / CINETPAY_SITE_ID / CINETPAY_SECRET_KEY
//   PAYMENT_RETURN_BASE_URL — base du portail (défaut https://spawt.online)
//   ALLOWED_ORIGINS         — CSV origins portail (CORS fail-closed, P-11)
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — injectés

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import {
  computeTtc,
  GOLD_PLAN_PRICING,
  isGoldPlan,
  PaymentProviderError,
  TVA_RATE,
} from "../_shared/payment/types.ts";
import { createPaymentProvider, PaymentConfigError } from "../_shared/payment/factory.ts";

// @ts-expect-error — Deno global
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Promise<Response> | Response) => void;
};

interface CheckoutPayload {
  plan: string;
  return_url?: string;
}

// ─── CORS — même pattern fail-closed que otp-send (P-11 / P-09) ─────────────

function readAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return [];
  return raw.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = readAllowedOrigins();
  const origin = req.headers.get("origin");
  // P-09 — origin non-whitelistée jamais reflétée : "null" systématique.
  const reflect = origin && allowed.includes(origin) ? origin : "null";
  return {
    "access-control-allow-origin": reflect,
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
}

function json(body: unknown, req: Request, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST, OPTIONS", ...corsHeaders(req) },
    });
  }

  let payload: CheckoutPayload;
  try {
    payload = (await req.json()) as CheckoutPayload;
  } catch {
    return json({ error: "invalid_json" }, req, 400);
  }

  if (!isGoldPlan(payload?.plan)) {
    return json({ error: "invalid_plan" }, req, 400);
  }
  const plan = payload.plan;

  // return_url : optionnelle, https only (elle part chez CinetPay pour le
  // redirect navigateur post-paiement). Défaut : portail /gold/retour.
  const returnBase = Deno.env.get("PAYMENT_RETURN_BASE_URL") ?? "https://spawt.online";
  const returnUrl = payload.return_url ?? `${returnBase}/gold/retour`;
  if (!/^https:\/\//.test(returnUrl)) {
    return json({ error: "invalid_return_url" }, req, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return json({ error: "edge_misconfigured" }, req, 500);
  }

  // ── Authentification spawter — client ANON + getUser(token). JAMAIS le
  // client service_role pour authentifier : on veut la validation GoTrue du
  // JWT utilisateur, pas un bypass. ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "invalid_token" }, req, 401);

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: "invalid_token" }, req, 401);
  }
  const spawterId: string = userData.user.id;

  // Écritures : service_role (les tables 0032 n'ont AUCUNE policy d'écriture
  // authenticated — design volontaire, cf. migration).
  const admin = createClient(supabaseUrl, serviceRole);

  // ── Résolution/création du customer B2C (lien 0002 : customers.spawter_id,
  // UNIQUE (spawter_id, customer_type)) ─────────────────────────────────────
  const { data: spawterRow, error: spawterErr } = await admin
    .from("spawters")
    .select("display_name, phone_e164")
    .eq("id", spawterId)
    .maybeSingle();
  if (spawterErr || !spawterRow) {
    return json({ error: "db_error", detail: "spawter_not_found" }, req, 500);
  }

  const { data: existingCustomer, error: custErr } = await admin
    .from("customers")
    .select("id")
    .eq("spawter_id", spawterId)
    .eq("customer_type", "b2c_individual")
    .maybeSingle();
  if (custErr) return json({ error: "db_error" }, req, 500);

  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id as string;
  } else {
    const { data: created, error: createErr } = await admin
      .from("customers")
      .insert({
        spawter_id: spawterId,
        customer_type: "b2c_individual",
        display_name: spawterRow.display_name ?? "Spawter",
        billing_country_code: "CI",
        billing_currency_code: "XOF",
      })
      .select("id")
      .single();
    if (createErr || !created) return json({ error: "db_error" }, req, 500);
    customerId = created.id as string;
  }

  // ── Refus si entitlement déjà actif — fenêtre du même prédicat que la vue
  // active_entitlements (0032). ARBITRAGE lifecycle Mobile Money (PRD §11.4,
  // pas de prélèvement auto) : seul le statut 'active' bloque un nouveau
  // checkout. Un abonnement en 'grace' n'empêche PAS de repayer — la grâce
  // EST la fenêtre de renouvellement (le webhook clôt alors l'ancien en
  // 'expired', supersédé). ─────────────────────────────────────────────────
  const { data: liveSubs, error: liveErr } = await admin
    .from("subscriptions")
    .select("id, status, expires_at, grace_until")
    .eq("customer_id", customerId)
    .eq("status", "active");
  if (liveErr) return json({ error: "db_error" }, req, 500);

  const now = Date.now();
  const hasActive = (liveSubs ?? []).some(
    (s: { expires_at: string | null; grace_until: string | null }) =>
      s.expires_at === null ||
      new Date(s.expires_at).getTime() > now ||
      (s.grace_until !== null && new Date(s.grace_until).getTime() > now),
  );
  if (hasActive) return json({ error: "already_active" }, req, 409);

  // ── Subscription pending + provider_tx_id unique (idempotence webhook) ────
  const pricing = GOLD_PLAN_PRICING[plan];
  const transactionId = `SPAWT-TX-${crypto.randomUUID()}`;
  const { data: subscription, error: subErr } = await admin
    .from("subscriptions")
    .insert({
      customer_id: customerId,
      customer_type: "b2c",
      plan,
      price_ht: pricing.price_ht,
      tva_rate: TVA_RATE,
      currency: "XOF",
      status: "pending",
      provider: "cinetpay",
      provider_tx_id: transactionId,
    })
    .select("id")
    .single();
  if (subErr || !subscription) return json({ error: "db_error" }, req, 500);

  // ── Initiation provider (interface IPaymentProvider — CinetPay remplaçable) ─
  try {
    const provider = createPaymentProvider();
    const result = await provider.initiate({
      transactionId,
      amount: computeTtc(pricing.price_ht), // TTC XOF entier (TVA CI 18 %)
      currency: "XOF",
      description: pricing.description,
      customerPhone: spawterRow.phone_e164 ?? "",
      customerName: spawterRow.display_name ?? "Spawter",
      returnUrl,
      notifyUrl: `${supabaseUrl}/functions/v1/payment-webhook`,
      metadata: { subscription_id: subscription.id as string, plan },
    });

    console.log(
      JSON.stringify({
        evt: "payment_checkout_initiated",
        provider: provider.name,
        transaction_id: transactionId,
        plan,
        spawter_id: spawterId,
      }),
    );
    return json({ payment_url: result.paymentUrl, transaction_id: transactionId }, req);
  } catch (err) {
    // Nettoyage : la subscription pending mort-née passe cancelled (le
    // provider_tx_id UNIQUE reste consommé — un retry régénère un uuid).
    await admin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", subscription.id);

    if (err instanceof PaymentConfigError) {
      return json({ error: "edge_misconfigured" }, req, 500);
    }
    console.log(
      JSON.stringify({
        evt: "payment_checkout_provider_error",
        transaction_id: transactionId,
        detail: err instanceof Error ? err.message : String(err),
      }),
    );
    return json({ error: "provider_error" }, req, 502);
  }
}

Deno.serve(handleRequest);
