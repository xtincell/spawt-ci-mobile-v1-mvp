// Tests Deno — `payment-webhook` (pattern otp-send : handleRequest exporté,
// envs resetés).
//
// Run :
//   deno test --allow-env --allow-net supabase/functions/payment-webhook/index.test.ts
//
// Couvre : méthodes HTTP, envs manquantes, parsing du corps (form/JSON),
// rejet signature invalide (400). Skip : chemin activation complet (nécessite
// mock Supabase + mock /v2/payment/check — la mécanique interne est couverte
// par _shared/payment/*.test.ts, l'intégration par la sandbox CinetPay).

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

import { handleRequest, isActivatableStatus, readWebhookFields } from "./index.ts";

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
