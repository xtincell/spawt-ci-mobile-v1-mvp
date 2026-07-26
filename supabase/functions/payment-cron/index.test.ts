// Tests Deno — `payment-cron` (pattern otp-send : handleRequest exporté,
// envs resetés).
//
// Run :
//   deno test --allow-env --allow-net supabase/functions/payment-cron/index.test.ts
//
// Couvre : méthodes HTTP, garde x-cron-key (fail-closed), envs manquantes.
// La logique de décision J-3/J/grâce/expiration est couverte par
// _shared/payment/subscription-lifecycle.test.ts (helpers purs).

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

import { handleRequest } from "./index.ts";

function resetEnv() {
  Deno.env.delete("CRON_SECRET");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/payment-cron", {
    method: "POST",
    headers,
  });
}

Deno.test("payment-cron: non-POST → 405", async () => {
  const req = new Request("http://localhost/payment-cron", { method: "GET" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 405);
});

Deno.test("payment-cron: x-cron-key absent → 409 unauthorized", async () => {
  resetEnv();
  Deno.env.set("CRON_SECRET", "cle-cron-test");
  const resp = await handleRequest(makeRequest());
  assertEquals(resp.status, 409);
  assertEquals((await resp.json()).error, "unauthorized");
  resetEnv();
});

Deno.test("payment-cron: x-cron-key erroné → 409 unauthorized", async () => {
  resetEnv();
  Deno.env.set("CRON_SECRET", "cle-cron-test");
  const resp = await handleRequest(makeRequest({ "x-cron-key": "mauvaise-cle" }));
  assertEquals(resp.status, 409);
  resetEnv();
});

Deno.test("payment-cron: CRON_SECRET non configuré → 409 (fail-closed)", async () => {
  resetEnv();
  const resp = await handleRequest(makeRequest({ "x-cron-key": "nimporte" }));
  assertEquals(resp.status, 409);
});

Deno.test("payment-cron: clé OK mais envs Supabase absentes → 500 edge_misconfigured", async () => {
  resetEnv();
  Deno.env.set("CRON_SECRET", "cle-cron-test");
  const resp = await handleRequest(makeRequest({ "x-cron-key": "cle-cron-test" }));
  assertEquals(resp.status, 500);
  assertEquals((await resp.json()).error, "edge_misconfigured");
  resetEnv();
});
