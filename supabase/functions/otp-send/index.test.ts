// Deno tests pour `otp-send` Edge Function — Story 2.3a AC #4.
//
// Run :
//   deno test --allow-env --allow-net supabase/functions/otp-send/index.test.ts
//
// Couvre :
//   1. Validation payload (format E.164, JSON parsing)
//   2. Méthodes HTTP (OPTIONS, POST, autre)
//   3. CORS headers (P4)
//   4. Missing env vars → 500 edge_misconfigured
//
// Skip : success path complet (nécessite mock Supabase admin + table
// `otp_attempts` — couvert en intégration alpha avec projet live).

import {
  assertEquals,
  assert,
  assertExists,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

import { handleRequest } from "./index.ts";

function makeRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request("http://localhost/otp-send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

function resetEnv() {
  // Force env propre pour isoler chaque test.
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_URL");
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  // @ts-expect-error — Deno global
  Deno.env.delete("TERMII_API_KEY");
  // @ts-expect-error — Deno global
  Deno.env.delete("MOCK_TERMII");
}

Deno.test("otp-send: OPTIONS preflight returns 204 + CORS headers (P4)", async () => {
  const req = new Request("http://localhost/otp-send", { method: "OPTIONS" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 204);
  assertExists(resp.headers.get("access-control-allow-origin"));
  assertExists(resp.headers.get("access-control-allow-methods"));
});

Deno.test("otp-send: non-POST returns 405 with allow header", async () => {
  const req = new Request("http://localhost/otp-send", { method: "GET" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 405);
  assertExists(resp.headers.get("allow"));
});

Deno.test("otp-send: invalid JSON returns 400 invalid_json", async () => {
  const req = makeRequest("not-json-{}");
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_json");
});

Deno.test("otp-send: missing phone_e164 returns 400 invalid_phone", async () => {
  const req = makeRequest({});
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_phone");
});

Deno.test("otp-send: malformed phone (no +) returns 400 invalid_phone", async () => {
  const req = makeRequest({ phone_e164: "225070000000" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_phone");
});

Deno.test("otp-send: phone too short returns 400 invalid_phone", async () => {
  const req = makeRequest({ phone_e164: "+225" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
});

Deno.test("otp-send: phone too long returns 400 invalid_phone", async () => {
  const req = makeRequest({ phone_e164: "+225" + "0".repeat(20) });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
});

Deno.test("otp-send: missing SUPABASE_URL env → 500 edge_misconfigured", async () => {
  resetEnv();
  const req = makeRequest({ phone_e164: "+2250707000000" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 500);
  const body = await resp.json();
  assertEquals(body.error, "edge_misconfigured");
});

Deno.test("otp-send: response includes CORS headers on all paths", async () => {
  resetEnv();
  const req = makeRequest({ phone_e164: "+2250707000000" });
  const resp = await handleRequest(req);
  assert(resp.headers.get("access-control-allow-origin") !== null);
});

// ── Review stores — numéros whitelistés (zéro SMS même en live) ────────────

import { isReviewerPhone } from "./index.ts";

Deno.test("isReviewerPhone: env absente → false", () => {
  // @ts-expect-error — Deno global
  Deno.env.delete("REVIEWER_PHONE_E164");
  if (isReviewerPhone("+2250700000001") !== false) throw new Error("attendu false");
});

Deno.test("isReviewerPhone: CSV avec espaces → match exact", () => {
  // @ts-expect-error — Deno global
  Deno.env.set("REVIEWER_PHONE_E164", "+2250700000001 , +2250700000002");
  if (isReviewerPhone("+2250700000002") !== true) throw new Error("attendu true");
  if (isReviewerPhone("+2250700000009") !== false) throw new Error("attendu false");
  // @ts-expect-error — Deno global
  Deno.env.delete("REVIEWER_PHONE_E164");
});
