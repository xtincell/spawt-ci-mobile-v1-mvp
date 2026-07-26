// Edge Function `payment-checkout` — Sprint 2 monétisation (PRD §13.8).
// Runtime : Deno (Supabase Edge).
//
// Modèle Spotify/Netflix : l'ACHAT se fait sur le portail web (spawt.online),
// jamais dans l'app (conformité Apple 3.1.3). Cette fonction est appelée par
// le portail avec le Bearer access_token du spawter connecté.
//
// Contrat (aligné sur project_spawt_mobile_ci/src/lib/api.ts) :
//   POST /functions/v1/payment-checkout
//   Headers : Authorization: Bearer <access_token spawter OU compte B2B> · apikey: <anon>
//   Body    : {"plan":"gold_monthly"|"gold_annual"|"pro"|"b2b_gold","return_url"?:"https://…"}
//   200 → {"payment_url":"https://…","transaction_id":"SPAWT-TX-…"}
//   400 → {"error":"invalid_json"|"invalid_plan"|"invalid_return_url"}
//   401 → {"error":"invalid_token"} (session expirée → relogin portail)
//   403 → {"error":"not_b2b"} (plan B2B sans compte b2b_accounts actif —
//         le rattachement lieu↔compte est un acte admin : contrôle MÉTIER,
//         pas un stub ; une fois relié, le paiement est 100 % en ligne)
//   409 → {"error":"already_active"} (droit déjà actif — B2C : par customer ;
//         B2B : par LIEU, tous comptes du lieu confondus)
//   502 → {"error":"provider_error"} (CinetPay indisponible)
//   500 → {"error":"edge_misconfigured"|"db_error"}
//
// Plans B2B (pro 15 000 HT / b2b_gold 65 000 HT, TVA 18 %) : l'appelant est
// le compte auth du lieu (0043). subscriptions.customer_type='b2b' ; le
// retour navigateur par défaut est /pro/retour (portail espace lieux).
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
  isB2bPlan,
  isPaidPlan,
  PLAN_PRICING,
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

/**
 * Normalise un téléphone (GoTrue stocke sans « + », un contact peut porter
 * espaces/tirets) vers E.164 — "" si rien d'exploitable.
 */
export function toE164(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/[^0-9]/g, "");
  return digits.length > 0 ? `+${digits}` : "";
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

  if (!isPaidPlan(payload?.plan)) {
    return json({ error: "invalid_plan" }, req, 400);
  }
  const plan = payload.plan;
  const isB2bCheckout = isB2bPlan(plan);

  // return_url : optionnelle, https only (elle part chez CinetPay pour le
  // redirect navigateur post-paiement). Défaut : portail /gold/retour (B2C)
  // ou /pro/retour (B2B — espace lieux).
  const returnBase = Deno.env.get("PAYMENT_RETURN_BASE_URL") ?? "https://spawt.online";
  const returnUrl =
    payload.return_url ?? `${returnBase}${isB2bCheckout ? "/pro/retour" : "/gold/retour"}`;
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
  // B2C : id du spawter. B2B : id du compte auth du lieu (b2b_accounts 0043).
  const callerId: string = userData.user.id;

  // Écritures : service_role (les tables 0032 n'ont AUCUNE policy d'écriture
  // authenticated — design volontaire, cf. migration).
  const admin = createClient(supabaseUrl, serviceRole);

  // Prédicat « droit encore vivant » — même fenêtre que la vue
  // active_entitlements (0032), partagé entre les checks B2C et B2B.
  const isLiveSub = (s: { expires_at: string | null; grace_until: string | null }): boolean => {
    const now = Date.now();
    return (
      s.expires_at === null ||
      new Date(s.expires_at).getTime() > now ||
      (s.grace_until !== null && new Date(s.grace_until).getTime() > now)
    );
  };

  let customerId: string;
  let customerPhone: string;
  let customerName: string;

  if (!isB2bCheckout) {
    // ═══ Branche B2C (gold_monthly / gold_annual) — flux historique ═══════════

    // ── Résolution/création du customer B2C (lien 0002 : customers.spawter_id,
    // UNIQUE (spawter_id, customer_type)) ─────────────────────────────────────
    const { data: spawterRow, error: spawterErr } = await admin
      .from("spawters")
      .select("display_name, phone_e164")
      .eq("id", callerId)
      .maybeSingle();
    if (spawterErr || !spawterRow) {
      return json({ error: "db_error", detail: "spawter_not_found" }, req, 500);
    }
    customerPhone = (spawterRow.phone_e164 as string | null) ?? "";
    customerName = (spawterRow.display_name as string | null) ?? "Spawter";

    const { data: existingCustomer, error: custErr } = await admin
      .from("customers")
      .select("id")
      .eq("spawter_id", callerId)
      .eq("customer_type", "b2c_individual")
      .maybeSingle();
    if (custErr) return json({ error: "db_error" }, req, 500);

    if (existingCustomer) {
      customerId = existingCustomer.id as string;
    } else {
      const { data: created, error: createErr } = await admin
        .from("customers")
        .insert({
          spawter_id: callerId,
          customer_type: "b2c_individual",
          display_name: customerName,
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
    if ((liveSubs ?? []).some(isLiveSub)) return json({ error: "already_active" }, req, 409);
  } else {
    // ═══ Branche B2B (pro / b2b_gold) — souscription en ligne d'un lieu ═══════

    // ── Gate MÉTIER (pas un stub) : seul un compte b2b_accounts ACTIF peut
    // payer un plan lieu. Le rattachement lieu↔compte reste un acte admin
    // (vérification du lieu par l'équipe) ; sans lui → 403 not_b2b et le
    // portail affiche le parcours de candidature. ─────────────────────────────
    const { data: b2bAccount, error: b2bErr } = await admin
      .from("b2b_accounts")
      .select("id, place_id, role, contact_name, contact_phone, is_active")
      .eq("auth_user_id", callerId)
      .maybeSingle();
    if (b2bErr) return json({ error: "db_error" }, req, 500);
    if (!b2bAccount || b2bAccount.is_active !== true) {
      return json({ error: "not_b2b" }, req, 403);
    }

    // Nom d'affichage/facturation : contact du compte, sinon nom public du lieu.
    let placeName: string | null = null;
    const { data: placeRow } = await admin
      .from("places")
      .select("name")
      .eq("id", b2bAccount.place_id)
      .maybeSingle();
    if (placeRow?.name) placeName = placeRow.name as string;
    customerName = (b2bAccount.contact_name as string | null) ?? placeName ?? "Lieu SPAWT";
    customerPhone = toE164(b2bAccount.contact_phone as string | null) ||
      toE164(userData.user.phone as string | null | undefined);

    // ── Ancre spawters : contrainte 0002 (customers.spawter_id NOT NULL → FK
    // spawters). Un compte B2B est un compte auth dédié, PAS un membre de la
    // Meute : s'il n'a jamais ouvert l'app (login portail uniquement), aucune
    // ligne spawters n'existe. On pose alors une ligne minimale qui sert
    // UNIQUEMENT d'ancre de facturation (0 spawt, stade touriste par défaut,
    // invisible dans les flux app). Si une migration future donne à customers
    // un lien B2B direct, cette ancre devient inutile — no-op pour les comptes
    // qui ont déjà un profil. ─────────────────────────────────────────────────
    const { data: anchorRow, error: anchorErr } = await admin
      .from("spawters")
      .select("id")
      .eq("id", callerId)
      .maybeSingle();
    if (anchorErr) return json({ error: "db_error" }, req, 500);
    if (!anchorRow) {
      const anchorPhone = toE164(userData.user.phone as string | null | undefined) ||
        toE164(b2bAccount.contact_phone as string | null);
      if (!/^\+[1-9]\d{1,14}$/.test(anchorPhone)) {
        // Sans téléphone exploitable on ne peut pas satisfaire la contrainte
        // phone_e164 — cas anormal (l'auth OTP porte toujours un phone).
        return json({ error: "db_error", detail: "b2b_phone_missing" }, req, 500);
      }
      const { error: anchorInsErr } = await admin.from("spawters").insert({
        id: callerId,
        phone_e164: anchorPhone,
        display_name: customerName,
      });
      if (anchorInsErr) return json({ error: "db_error" }, req, 500);
    }

    // ── Résolution/création du customer B2B (0002 : customer_type
    // 'b2b_business', UNIQUE (spawter_id, customer_type)) ─────────────────────
    const { data: existingCustomer, error: custErr } = await admin
      .from("customers")
      .select("id")
      .eq("spawter_id", callerId)
      .eq("customer_type", "b2b_business")
      .maybeSingle();
    if (custErr) return json({ error: "db_error" }, req, 500);

    if (existingCustomer) {
      customerId = existingCustomer.id as string;
    } else {
      const { data: created, error: createErr } = await admin
        .from("customers")
        .insert({
          spawter_id: callerId,
          customer_type: "b2b_business",
          display_name: customerName,
          billing_country_code: "CI",
          billing_currency_code: "XOF",
        })
        .select("id")
        .single();
      if (createErr || !created) return json({ error: "db_error" }, req, 500);
      customerId = created.id as string;
    }

    // ── 409 already_active PAR LIEU : un lieu peut avoir plusieurs comptes
    // contacts (b2b_accounts n'est pas UNIQUE par place_id) — un abonnement
    // vivant payé par N'IMPORTE quel compte du lieu bloque un second paiement.
    // Même arbitrage que B2C : 'grace' ne bloque pas (fenêtre de
    // renouvellement, l'ancien sera supersédé par le webhook). ────────────────
    const { data: siblingAccounts, error: sibErr } = await admin
      .from("b2b_accounts")
      .select("auth_user_id")
      .eq("place_id", b2bAccount.place_id);
    if (sibErr) return json({ error: "db_error" }, req, 500);
    const siblingAuthIds = (siblingAccounts ?? []).map(
      (a: { auth_user_id: string }) => a.auth_user_id,
    );
    if (siblingAuthIds.length > 0) {
      const { data: placeCustomers, error: pcErr } = await admin
        .from("customers")
        .select("id")
        .in("spawter_id", siblingAuthIds)
        .eq("customer_type", "b2b_business");
      if (pcErr) return json({ error: "db_error" }, req, 500);
      const placeCustomerIds = (placeCustomers ?? []).map((c: { id: string }) => c.id);
      if (placeCustomerIds.length > 0) {
        const { data: liveSubs, error: liveErr } = await admin
          .from("subscriptions")
          .select("id, status, expires_at, grace_until")
          .in("customer_id", placeCustomerIds)
          .eq("status", "active");
        if (liveErr) return json({ error: "db_error" }, req, 500);
        if ((liveSubs ?? []).some(isLiveSub)) {
          return json({ error: "already_active" }, req, 409);
        }
      }
    }
  }

  // ── Subscription pending + provider_tx_id unique (idempotence webhook) ────
  const pricing = PLAN_PRICING[plan];
  const transactionId = `SPAWT-TX-${crypto.randomUUID()}`;
  const { data: subscription, error: subErr } = await admin
    .from("subscriptions")
    .insert({
      customer_id: customerId,
      customer_type: isB2bCheckout ? "b2b" : "b2c",
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
      customerPhone,
      customerName,
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
        customer_type: isB2bCheckout ? "b2b" : "b2c",
        caller_id: callerId,
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
