// Tests Deno — CinetPayProvider (mapping initiate/check, HMAC webhook).
//
// Run :
//   deno test --allow-env supabase/functions/_shared/payment/cinetpay.test.ts
//
// Zéro réseau : fetch stubé via `fetchImpl` injecté dans la config.

import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

import {
  buildWebhookHmacData,
  CinetPayProvider,
  hmacSha256Hex,
  mapCinetPayStatus,
  timingSafeEqualHex,
} from "./cinetpay.ts";
import { computeTtc, GOLD_PLAN_PRICING, PaymentProviderError } from "./types.ts";

const CONFIG = {
  apiKey: "apikey-test",
  siteId: "5867973",
  secretKey: "secret-test-spawt",
};

interface RecordedCall {
  url: string;
  body: Record<string, unknown>;
}

function makeFetchStub(
  respond: (url: string) => { status: number; body: unknown },
): { impl: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    const { status, body } = respond(url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, calls };
}

// ── Montants TTC (TVA CI 18 %) ──────────────────────────────────────────────

Deno.test("pricing: gold_monthly 2500 HT → 2950 TTC", () => {
  assertEquals(computeTtc(GOLD_PLAN_PRICING.gold_monthly.price_ht), 2950);
});

Deno.test("pricing: gold_annual 25000 HT → 29500 TTC", () => {
  assertEquals(computeTtc(GOLD_PLAN_PRICING.gold_annual.price_ht), 29500);
});

Deno.test("pricing: arrondi TVA au franc (round half-up)", () => {
  // 1 111 × 18 % = 199.98 → 200 → TTC 1311.
  assertEquals(computeTtc(1111), 1311);
});

// ── initiate ────────────────────────────────────────────────────────────────

Deno.test("initiate: mappe le contrat /v2/payment (TTC, XOF, MOBILE_MONEY)", async () => {
  const stub = makeFetchStub(() => ({
    status: 200,
    body: {
      code: "201",
      message: "CREATED",
      data: { payment_url: "https://checkout.cinetpay.com/payment/abc", payment_token: "tok" },
    },
  }));
  const provider = new CinetPayProvider({ ...CONFIG, fetchImpl: stub.impl });
  const result = await provider.initiate({
    transactionId: "SPAWT-TX-test-1",
    amount: 2950,
    currency: "XOF",
    description: "Spawter Gold — 1 mois",
    customerPhone: "+2250707000000",
    customerName: "Awa",
    returnUrl: "https://spawt.online/gold/retour",
    notifyUrl: "https://x.supabase.co/functions/v1/payment-webhook",
  });

  assertEquals(result.paymentUrl, "https://checkout.cinetpay.com/payment/abc");
  assertEquals(result.transactionId, "SPAWT-TX-test-1");
  assertEquals(stub.calls.length, 1);
  assert(stub.calls[0].url.endsWith("/v2/payment"));
  const sent = stub.calls[0].body;
  assertEquals(sent.apikey, "apikey-test");
  assertEquals(sent.site_id, "5867973");
  assertEquals(sent.transaction_id, "SPAWT-TX-test-1");
  assertEquals(sent.amount, 2950); // TTC entier XOF
  assertEquals(sent.currency, "XOF");
  assertEquals(sent.channels, "MOBILE_MONEY");
  assertEquals(sent.notify_url, "https://x.supabase.co/functions/v1/payment-webhook");
  assertEquals(sent.return_url, "https://spawt.online/gold/retour");
  assertEquals(sent.customer_phone_number, "+2250707000000");
});

Deno.test("initiate: code != 201 → PaymentProviderError", async () => {
  const stub = makeFetchStub(() => ({
    status: 200,
    body: { code: "608", message: "MINIMUM_REQUIRED_FIELDS" },
  }));
  const provider = new CinetPayProvider({ ...CONFIG, fetchImpl: stub.impl });
  await assertRejects(
    () =>
      provider.initiate({
        transactionId: "SPAWT-TX-test-2",
        amount: 2950,
        currency: "XOF",
        description: "d",
        customerPhone: "+2250707000000",
        customerName: "Awa",
        returnUrl: "https://spawt.online/gold/retour",
        notifyUrl: "https://x/webhook",
      }),
    PaymentProviderError,
  );
});

// ── getStatus (/v2/payment/check) ───────────────────────────────────────────

Deno.test("getStatus: ACCEPTED → accepted + méthode + date", async () => {
  const stub = makeFetchStub(() => ({
    status: 200,
    body: {
      code: "00",
      message: "SUCCES",
      data: {
        status: "ACCEPTED",
        amount: 2950,
        currency: "XOF",
        payment_method: "WAVE_CI",
        payment_date: "2026-07-26 08:20:11",
      },
    },
  }));
  const provider = new CinetPayProvider({ ...CONFIG, fetchImpl: stub.impl });
  const conf = await provider.getStatus("SPAWT-TX-test-3");
  assert(stub.calls[0].url.endsWith("/v2/payment/check"));
  assertEquals(stub.calls[0].body.transaction_id, "SPAWT-TX-test-3");
  assertEquals(conf.status, "accepted");
  assertEquals(conf.amount, 2950);
  assertEquals(conf.paymentMethod, "WAVE_CI");
  assertEquals(conf.paidAt, "2026-07-26 08:20:11");
});

Deno.test("getStatus: REFUSED → refused ; WAITING → pending", async () => {
  assertEquals(mapCinetPayStatus("REFUSED", "600"), "refused");
  assertEquals(mapCinetPayStatus("WAITING_FOR_CUSTOMER", "662"), "pending");
  assertEquals(mapCinetPayStatus("PENDING", undefined), "pending");
});

Deno.test("getStatus: statut inconnu → pending (jamais d'activation aveugle)", () => {
  assertEquals(mapCinetPayStatus("SOMETHING_NEW", "999"), "pending");
  assertEquals(mapCinetPayStatus(undefined, undefined), "pending");
});

Deno.test("getStatus: fallback code seul — 00 accepted, 627 refused", () => {
  assertEquals(mapCinetPayStatus(undefined, "00"), "accepted");
  assertEquals(mapCinetPayStatus(undefined, "627"), "refused");
});

// ── Webhook HMAC (x-token) ──────────────────────────────────────────────────

// Fixture : token pré-calculé hors-runtime (node crypto) avec la même
// concaténation documentée — vérifie que l'implémentation Web Crypto produit
// bien un HMAC-SHA256 standard, pas seulement qu'elle est cohérente avec
// elle-même.
const WEBHOOK_BODY: Record<string, string> = {
  cpm_site_id: "5867973",
  cpm_trans_id: "SPAWT-TX-11111111-2222-3333-4444-555555555555",
  cpm_trans_date: "2026-07-26 08:15:00",
  cpm_amount: "2950",
  cpm_currency: "XOF",
  signature: "sig-opaque-cinetpay",
  payment_method: "ORANGE_MONEY_CI",
  cel_phone_num: "0707000000",
  cpm_phone_prefixe: "225",
  cpm_language: "fr",
  cpm_version: "V4",
  cpm_payment_config: "SINGLE",
  cpm_page_action: "PAYMENT",
  cpm_custom: "",
  cpm_designation: "Spawter Gold — 1 mois",
  cpm_error_message: "SUCCES",
};
const EXPECTED_TOKEN = "ec111b9b80b080ce03bf7a28f4a13a87829bec8f6d7980735f93c781a830fe38";

Deno.test("hmacSha256Hex: parité avec HMAC-SHA256 de référence (node)", async () => {
  const token = await hmacSha256Hex(CONFIG.secretKey, buildWebhookHmacData(WEBHOOK_BODY));
  assertEquals(token, EXPECTED_TOKEN);
});

Deno.test("parseWebhook: x-token valide → signatureValid + transactionId", async () => {
  const provider = new CinetPayProvider(CONFIG);
  const event = await provider.parseWebhook(
    new Headers({ "x-token": EXPECTED_TOKEN }),
    WEBHOOK_BODY,
  );
  assertEquals(event.signatureValid, true);
  assertEquals(event.transactionId, "SPAWT-TX-11111111-2222-3333-4444-555555555555");
  assertEquals(event.announcedStatus, "accepted");
});

Deno.test("parseWebhook: x-token invalide → signatureValid=false", async () => {
  const provider = new CinetPayProvider(CONFIG);
  const bad = await provider.parseWebhook(
    new Headers({ "x-token": "deadbeef".repeat(8) }),
    WEBHOOK_BODY,
  );
  assertEquals(bad.signatureValid, false);
});

Deno.test("parseWebhook: x-token absent → signatureValid=false", async () => {
  const provider = new CinetPayProvider(CONFIG);
  const event = await provider.parseWebhook(new Headers(), WEBHOOK_BODY);
  assertEquals(event.signatureValid, false);
});

Deno.test("parseWebhook: body altéré (montant) → signature refusée", async () => {
  const provider = new CinetPayProvider(CONFIG);
  const tampered = { ...WEBHOOK_BODY, cpm_amount: "1" };
  const event = await provider.parseWebhook(
    new Headers({ "x-token": EXPECTED_TOKEN }),
    tampered,
  );
  assertEquals(event.signatureValid, false);
});

Deno.test("timingSafeEqualHex: longueurs différentes → false", () => {
  assertEquals(timingSafeEqualHex("abc", "abcd"), false);
  assertEquals(timingSafeEqualHex("abcd", "abcd"), true);
});
