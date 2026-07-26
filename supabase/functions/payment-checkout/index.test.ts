// Tests Deno — `payment-checkout` (même pattern que otp-send/index.test.ts :
// handleRequest exporté, envs resetés par test).
//
// Run :
//   deno test --allow-env --allow-net supabase/functions/payment-checkout/index.test.ts
//
// Couvre : méthodes HTTP, CORS, validation payload (plan, return_url),
// auth manquante, envs manquantes. Skip : success path complet (nécessite un
// mock GoTrue + tables customers/subscriptions — couvert en intégration
// sandbox CinetPay, cf. HUMAN_TODO).

import { assertEquals, assertExists } from "https://deno.land/std@0.220.0/assert/mod.ts";

import { handleRequest } from "./index.ts";

function makeRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request("http://localhost/payment-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

function resetEnv() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_ANON_KEY");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("CINETPAY_API_KEY");
  Deno.env.delete("CINETPAY_SITE_ID");
  Deno.env.delete("CINETPAY_SECRET_KEY");
  Deno.env.delete("PAYMENT_RETURN_BASE_URL");
}

Deno.test("payment-checkout: OPTIONS preflight → 204 + CORS headers", async () => {
  const req = new Request("http://localhost/payment-checkout", { method: "OPTIONS" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 204);
  assertExists(resp.headers.get("access-control-allow-origin"));
});

Deno.test("payment-checkout: non-POST → 405 avec allow header", async () => {
  const req = new Request("http://localhost/payment-checkout", { method: "GET" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 405);
  assertExists(resp.headers.get("allow"));
});

Deno.test("payment-checkout: JSON invalide → 400 invalid_json", async () => {
  const resp = await handleRequest(makeRequest("pas-du-json-{"));
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_json");
});

Deno.test("payment-checkout: plan inconnu → 400 invalid_plan", async () => {
  const resp = await handleRequest(makeRequest({ plan: "gold_weekly" }));
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_plan");
});

Deno.test("payment-checkout: plan absent → 400 invalid_plan", async () => {
  const resp = await handleRequest(makeRequest({}));
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_plan");
});

Deno.test("payment-checkout: return_url non-https → 400 invalid_return_url", async () => {
  const resp = await handleRequest(
    makeRequest({ plan: "gold_monthly", return_url: "http://insecure.example/retour" }),
  );
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_return_url");
});

Deno.test("payment-checkout: envs Supabase absentes → 500 edge_misconfigured", async () => {
  resetEnv();
  const resp = await handleRequest(makeRequest({ plan: "gold_monthly" }));
  assertEquals(resp.status, 500);
  assertEquals((await resp.json()).error, "edge_misconfigured");
});

Deno.test("payment-checkout: Authorization absent → 401 invalid_token", async () => {
  resetEnv();
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test");
  const resp = await handleRequest(makeRequest({ plan: "gold_annual" }));
  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "invalid_token");
  resetEnv();
});

Deno.test("payment-checkout: CORS présent sur toutes les réponses", async () => {
  resetEnv();
  const resp = await handleRequest(makeRequest({ plan: "gold_monthly" }));
  assertExists(resp.headers.get("access-control-allow-origin"));
});
