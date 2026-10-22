// Tests Deno — `payment-webhook` (pattern otp-send : handleRequest exporté,
// envs resetés).
//
// Run :
//   deno test --allow-env --allow-net supabase/functions/payment-webhook/index.test.ts
//
// Couvre : méthodes HTTP, envs manquantes, parsing du corps (form/JSON),
// rejet signature invalide (400), et — sur un faux réseau PostgREST/CinetPay
// — le chemin d'activation : la facture reprend les montants FIGÉS sur
// l'abonnement au checkout (0079), sans jamais lire `plans`. L'intégration
// réelle reste à valider en sandbox CinetPay.

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

import { handleRequest, isActivatableStatus, readWebhookFields } from "./index.ts";
import { buildWebhookHmacData, hmacSha256Hex } from "../_shared/payment/cinetpay.ts";

function resetEnv() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("CINETPAY_API_KEY");
  Deno.env.delete("CINETPAY_SITE_ID");
  Deno.env.delete("CINETPAY_SECRET_KEY");
  Deno.env.delete("PAYMENT_PROVIDER");
}

function setBaseEnv() {
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test");
  Deno.env.set("CINETPAY_API_KEY", "apikey-test");
  Deno.env.set("CINETPAY_SITE_ID", "5867973");
  Deno.env.set("CINETPAY_SECRET_KEY", "secret-test-spawt");
}

function formRequest(fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  const params = new URLSearchParams(fields);
  return new Request("http://localhost/payment-webhook", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: params.toString(),
  });
}

Deno.test("payment-webhook: non-POST → 405", async () => {
  const req = new Request("http://localhost/payment-webhook", { method: "GET" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 405);
});

Deno.test("payment-webhook: envs Supabase absentes → 500 edge_misconfigured", async () => {
  resetEnv();
  const resp = await handleRequest(formRequest({ cpm_trans_id: "SPAWT-TX-x" }));
  assertEquals(resp.status, 500);
  assertEquals((await resp.json()).error, "edge_misconfigured");
});

Deno.test("payment-webhook: secrets CinetPay absents → 500 edge_misconfigured", async () => {
  resetEnv();
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test");
  const resp = await handleRequest(formRequest({ cpm_trans_id: "SPAWT-TX-x" }));
  assertEquals(resp.status, 500);
  assertEquals((await resp.json()).error, "edge_misconfigured");
  resetEnv();
});

Deno.test("payment-webhook: corps vide → 400 invalid_payload", async () => {
  resetEnv();
  setBaseEnv();
  const req = new Request("http://localhost/payment-webhook", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "",
  });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_payload");
  resetEnv();
});

Deno.test("payment-webhook: x-token absent → 400 invalid_signature", async () => {
  resetEnv();
  setBaseEnv();
  const resp = await handleRequest(formRequest({ cpm_trans_id: "SPAWT-TX-abc" }));
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_signature");
  resetEnv();
});

Deno.test("payment-webhook: x-token invalide → 400 invalid_signature", async () => {
  resetEnv();
  setBaseEnv();
  const resp = await handleRequest(
    formRequest(
      { cpm_trans_id: "SPAWT-TX-abc", cpm_amount: "2950" },
      { "x-token": "deadbeef".repeat(8) },
    ),
  );
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_signature");
  resetEnv();
});

// ── Anti-réactivation (finding P1#5) : replay-sur-expired → no-op ───────────
// getStatus répond `accepted` à vie ; seule une sub en état INITIAL de paiement
// peut être activée. Une re-notification d'une vieille transaction sur une sub
// passée 'expired'/'grace' par le cron ne doit JAMAIS la réactiver.
Deno.test("isActivatableStatus: n'active que depuis pending/cancelled", () => {
  assertEquals(isActivatableStatus("pending"), true);
  assertEquals(isActivatableStatus("cancelled"), true);
  // Replay-sur-expired / grace / active → refusé (no-op, pas de Gold gratuit).
  assertEquals(isActivatableStatus("expired"), false);
  assertEquals(isActivatableStatus("grace"), false);
  assertEquals(isActivatableStatus("active"), false);
});

// ── readWebhookFields : tolérance de formats ────────────────────────────────

Deno.test("readWebhookFields: form-urlencoded → map plate", async () => {
  const fields = await readWebhookFields(
    formRequest({ cpm_trans_id: "SPAWT-TX-1", cpm_amount: "2950" }),
  );
  assertEquals(fields?.cpm_trans_id, "SPAWT-TX-1");
  assertEquals(fields?.cpm_amount, "2950");
});

Deno.test("readWebhookFields: JSON → map plate (valeurs stringifiées)", async () => {
  const req = new Request("http://localhost/payment-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cpm_trans_id: "SPAWT-TX-2", cpm_amount: 2950 }),
  });
  const fields = await readWebhookFields(req);
  assertEquals(fields?.cpm_trans_id, "SPAWT-TX-2");
  assertEquals(fields?.cpm_amount, "2950");
});

Deno.test("readWebhookFields: JSON non-objet → null", async () => {
  const req = new Request("http://localhost/payment-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(["pas", "un", "objet"]),
  });
  assertEquals(await readWebhookFields(req), null);
});

// ── Activation : la facture reprend les montants figés au checkout ──────────
// Faux réseau PostgREST + CinetPay (/v2/payment/check). La signature x-token
// est calculée avec le vrai algorithme HMAC du provider. `plans` répond 500 et
// la moindre lecture est tracée : le webhook ne doit jamais y toucher — le
// tarif courant a pu changer depuis le checkout.

const WH_TX = "SPAWT-TX-00000000-0000-4000-8000-0000000000f1";
const WH_SUB = "00000000-0000-4000-8000-0000000000d1";
const WH_CUSTOMER = "00000000-0000-4000-8000-0000000000b1";
const WH_CALLER = "00000000-0000-4000-8000-0000000000c1";

interface WebhookCapture {
  confirmation: Record<string, unknown> | null;
  writes: string[];
  plansRead: boolean;
  logs: string[];
}

function installFakeWebhookBackend(
  sub: Record<string, unknown>,
  confirmedAmount: number,
  options: { currency?: string | null; rpcError?: boolean } = {},
): { capture: WebhookCapture; restore: () => void } {
  const capture: WebhookCapture = { confirmation: null, writes: [], plansRead: false, logs: [] };
  const realFetch = globalThis.fetch;
  const realLog = console.log;
  // Minuteries d'auto-rafraîchissement de session de supabase-js : tracées et
  // arrêtées en fin de test (contrôle de fuites de Deno actif pour le reste).
  const realSetInterval = globalThis.setInterval;
  const realSetTimeout = globalThis.setTimeout;
  const timers: ReturnType<typeof globalThis.setTimeout>[] = [];
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const id = realSetInterval(...args);
    timers.push(id);
    return id;
  }) as typeof setInterval;
  globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
    const id = realSetTimeout(...args);
    timers.push(id);
    return id;
  }) as typeof setTimeout;
  console.log = (...args: unknown[]) => {
    capture.logs.push(args.map(String).join(" "));
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;

    if (url.host === "cinetpay.test" && url.pathname === "/v2/payment/check") {
      return reply({
        code: "00",
        message: "SUCCES",
        data: {
          status: "ACCEPTED",
          amount: String(confirmedAmount),
          currency: options.currency === undefined ? "XOF" : options.currency,
          payment_date: "2026-10-18 10:00:00",
          payment_method: "WAVECI",
        },
      });
    }
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "plans") {
      capture.plansRead = true;
      return reply({ message: "le webhook ne lit pas plans" }, 500);
    }
    if (table === "subscriptions" && method === "GET") return reply([sub]);
    if (method !== "GET") capture.writes.push(table);
    if (table === "rpc/confirm_provider_payment" && method === "POST") {
      capture.confirmation = body;
      return options.rpcError
        ? reply({ message: "invoice write failed", code: "23514" }, 400)
        : reply({ received: true, status: "active", invoice_id: "verified-in-sql-test" });
    }
    return reply({ message: `route non simulée : ${method} ${url.pathname}` }, 500);
  }) as typeof fetch;
  return {
    capture,
    restore: () => {
      globalThis.fetch = realFetch;
      console.log = realLog;
      globalThis.setInterval = realSetInterval;
      globalThis.setTimeout = realSetTimeout;
      timers.forEach((id) => clearTimeout(id));
    },
  };
}

async function notifyAccepted(
  sub: Record<string, unknown>,
  confirmedAmount: number,
  options: { currency?: string | null; rpcError?: boolean } = {},
): Promise<{ status: number; body: Record<string, unknown>; capture: WebhookCapture }> {
  resetEnv();
  setBaseEnv();
  Deno.env.set("CINETPAY_BASE_URL", "https://cinetpay.test");
  const fields: Record<string, string> = {
    cpm_site_id: "5867973",
    cpm_trans_id: WH_TX,
    cpm_trans_date: "2026-10-18 10:00:00",
    cpm_amount: String(confirmedAmount),
    cpm_currency: "XOF",
    cpm_error_message: "SUCCES",
  };
  const token = await hmacSha256Hex("secret-test-spawt", buildWebhookHmacData(fields));
  const backend = installFakeWebhookBackend(sub, confirmedAmount, options);
  try {
    const resp = await handleRequest(formRequest(fields, { "x-token": token }));
    return { status: resp.status, body: await resp.json(), capture: backend.capture };
  } finally {
    backend.restore();
    resetEnv();
    Deno.env.delete("CINETPAY_BASE_URL");
  }
}

function pendingSub(patch: Record<string, unknown>): Record<string, unknown> {
  return {
    id: WH_SUB,
    customer_id: WH_CUSTOMER,
    customer_type: "b2b",
    plan: "b2b_gold",
    price_ht: 50847,
    price_ttc: 60000,
    tva_rate: 18,
    currency: "XOF",
    status: "pending",
    ...patch,
  };
}

Deno.test("payment-webhook: Gold lieu confirmé à 60 000 → une seule confirmation atomique, sans lire plans", async () => {
  const { status, body, capture } = await notifyAccepted(pendingSub({}), 60000);
  assertEquals(status, 200);
  assertEquals(body.status, "active");
  assertEquals(capture.plansRead, false);
  assertEquals(capture.writes, ["rpc/confirm_provider_payment"]);
  assertEquals(capture.confirmation, {
    p_transaction_id: WH_TX, p_provider: "cinetpay", p_amount: 60000,
    p_currency: "XOF", p_paid_at: "2026-10-18 10:00:00",
  });
});

Deno.test("payment-webhook: tarif changé depuis le checkout → confirme le prix figé", async () => {
  const { body, capture } = await notifyAccepted(pendingSub({ price_ht: 46653, price_ttc: 55050 }), 55050);
  assertEquals(body.status, "active");
  assertEquals(capture.plansRead, false);
  assertEquals(capture.confirmation?.p_amount, 55050);
});

Deno.test("payment-webhook: abonnement antérieur à 0079 → confirme le montant historique", async () => {
  const { body, capture } = await notifyAccepted(pendingSub({ price_ht: 65000, price_ttc: null }), 76700);
  assertEquals(body.status, "active");
  assertEquals(capture.confirmation?.p_amount, 76700);
});

for (const amount of [59999, 60001, 0, -1, 60000.5]) {
  Deno.test(`payment-webhook: montant confirmé ${amount} incohérent → aucune activation`, async () => {
    const { status, body, capture } = await notifyAccepted(pendingSub({}), amount);
    assertEquals(status, 200);
    assertEquals(body.ignored, "payment_mismatch");
    assertEquals(capture.writes, []);
    assertEquals(capture.logs.some(l => l.includes("rejected_payment_mismatch")), true);
  });
}
for (const currency of ["USD", null]) {
  Deno.test(`payment-webhook: devise ${currency} incohérente ou absente → aucune activation`, async () => {
    const { body, capture } = await notifyAccepted(pendingSub({}), 60000, { currency });
    assertEquals(body.ignored, "payment_mismatch");
    assertEquals(capture.writes, []);
  });
}
Deno.test("payment-webhook: erreur de transaction → 500 pour retenter, jamais de faux succès", async () => {
  const { status, body, capture } = await notifyAccepted(pendingSub({}), 60000, { rpcError: true });
  assertEquals(status, 500);
  assertEquals(body.error, "db_error");
  assertEquals(capture.writes, ["rpc/confirm_provider_payment"]);
});
for (const state of ["active", "expired", "grace"]) {
  Deno.test(`payment-webhook: répétition après état ${state} → aucune nouvelle écriture`, async () => {
    const { body, capture } = await notifyAccepted(pendingSub({ status: state }), 60000);
    assertEquals(body.idempotent, true);
    assertEquals(capture.writes, []);
  });
}
