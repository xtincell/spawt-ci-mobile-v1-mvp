// Deno tests pour `otp-verify` Edge Function — Story 2.3a AC #4.
//
// Run :
//   deno test --allow-env --allow-net supabase/functions/otp-verify/index.test.ts
//
// Couvre :
//   1. Validation payload (format E.164, OTP regex, JSON parsing)
//   2. Méthodes HTTP (OPTIONS, POST, autre)
//   3. CORS headers (P4)
//   4. Missing env vars → 500 edge_misconfigured
//
// Skip : success path complet + replay protection (P3) — nécessite mock
// Supabase admin + table `otp_attempts` + verifyOtp server-side. Couvert
// en intégration alpha avec projet live.

import {
  assertEquals,
  assert,
  assertExists,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

import { handleRequest, claimMeuteHeritage } from "./index.ts";

function makeRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request("http://localhost/otp-verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

function resetEnv() {
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_URL");
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_ANON_KEY");
  // @ts-expect-error — Deno global
  Deno.env.delete("TERMII_API_KEY");
  // @ts-expect-error — Deno global
  Deno.env.delete("MOCK_TERMII");
}

Deno.test("otp-verify: OPTIONS preflight returns 204 + CORS headers (P4)", async () => {
  const req = new Request("http://localhost/otp-verify", { method: "OPTIONS" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 204);
  assertExists(resp.headers.get("access-control-allow-origin"));
});

Deno.test("otp-verify: non-POST returns 405 with allow header", async () => {
  const req = new Request("http://localhost/otp-verify", { method: "GET" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 405);
  assertExists(resp.headers.get("allow"));
});

Deno.test("otp-verify: invalid JSON returns 400 invalid_json", async () => {
  const req = makeRequest("garbage");
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_json");
});

Deno.test("otp-verify: missing phone returns 400 invalid_phone", async () => {
  const req = makeRequest({ otp_code: "123456" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_phone");
});

Deno.test("otp-verify: missing otp_code returns 400 invalid_otp", async () => {
  const req = makeRequest({ phone_e164: "+2250707000000" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_otp");
});

Deno.test("otp-verify: otp_code wrong length returns 400 invalid_otp", async () => {
  const req = makeRequest({ phone_e164: "+2250707000000", otp_code: "12345" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_otp");
});

Deno.test("otp-verify: otp_code non-numeric returns 400 invalid_otp", async () => {
  const req = makeRequest({ phone_e164: "+2250707000000", otp_code: "12ab56" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_otp");
});

// #V07 — le code mock 6 chiffres (aligné pin Termii) passe la validation de
// frontière (la suite requiert les env vars Supabase → 500 edge_misconfigured
// dans ce harness).
Deno.test("otp-verify: 6-digit mock code passes boundary validation", async () => {
  resetEnv();
  const req = makeRequest({ phone_e164: "+2250707000000", otp_code: "123456" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 500);
  const body = await resp.json();
  assertEquals(body.error, "edge_misconfigured");
});

Deno.test("otp-verify: 9-digit otp_code returns 400 invalid_otp", async () => {
  const req = makeRequest({ phone_e164: "+2250707000000", otp_code: "123456789" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_otp");
});

Deno.test("otp-verify: missing SUPABASE_ANON_KEY env → 500 edge_misconfigured", async () => {
  resetEnv();
  // @ts-expect-error — Deno global
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  // @ts-expect-error — Deno global
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  // SUPABASE_ANON_KEY absent volontairement (Story 2.3a requirement).
  const req = makeRequest({ phone_e164: "+2250707000000", otp_code: "123456" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 500);
  const body = await resp.json();
  assertEquals(body.error, "edge_misconfigured");
});

Deno.test("otp-verify: response includes CORS headers on all paths", async () => {
  resetEnv();
  const req = makeRequest({ phone_e164: "+2250707000000", otp_code: "123456" });
  const resp = await handleRequest(req);
  assert(resp.headers.get("access-control-allow-origin") !== null);
});

// ── Chantier 13 archétypes — héritage Meute STRICTEMENT non bloquant ───────
// La RPC `claim_meute_heritage` (migration 0033) peut être absente (migration
// pas encore appliquée), en erreur, ou lever : le helper doit TOUJOURS
// retourner (null) sans jamais throw — le login n'est jamais cassé.

Deno.test("claimMeuteHeritage: fonction SQL absente (error PostgREST) → null, pas de throw", async () => {
  const admin = {
    rpc: () =>
      Promise.resolve({
        data: null,
        error: { message: "function public.claim_meute_heritage does not exist" },
      }),
  };
  const out = await claimMeuteHeritage(admin, "00000000-0000-4000-8000-000000000000", "+2250707000000");
  assertEquals(out, null);
});

Deno.test("claimMeuteHeritage: rpc qui throw (réseau) → null, pas de throw", async () => {
  const admin = {
    rpc: () => Promise.reject(new Error("network down")),
  };
  const out = await claimMeuteHeritage(admin, "00000000-0000-4000-8000-000000000000", "+2250707000000");
  assertEquals(out, null);
});

Deno.test("claimMeuteHeritage: succès → relaye le jsonb {claimed, archetype, pionnier_seq}", async () => {
  const payload = { claimed: true, archetype: "pisteur", pionnier_seq: 42 };
  const admin = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      assertEquals(fn, "claim_meute_heritage");
      assertEquals(args.p_phone, "+2250707000000");
      return Promise.resolve({ data: payload, error: null });
    },
  };
  const out = await claimMeuteHeritage(admin, "00000000-0000-4000-8000-000000000000", "+2250707000000");
  assertEquals(out, payload);
});

// ── Review stores — chemin reviewer whitelisté ─────────────────────────────
// isReviewerLogin : actif seulement si REVIEWER_PHONE_E164 ET
// REVIEWER_OTP_CODE (6-8 chiffres) sont posés ; sinon comportement inchangé.

import { isReviewerLogin } from "./index.ts";

function resetReviewerEnv() {
  // @ts-expect-error — Deno global
  Deno.env.delete("REVIEWER_PHONE_E164");
  // @ts-expect-error — Deno global
  Deno.env.delete("REVIEWER_OTP_CODE");
}

Deno.test("isReviewerLogin: envs absentes → false", () => {
  resetReviewerEnv();
  assertEquals(isReviewerLogin("+2250700000001", "424242"), false);
});

Deno.test("isReviewerLogin: numéro + code exacts → true (CSV, espaces tolérés)", () => {
  resetReviewerEnv();
  // @ts-expect-error — Deno global
  Deno.env.set("REVIEWER_PHONE_E164", "+2250700000001, +2250700000002");
  // @ts-expect-error — Deno global
  Deno.env.set("REVIEWER_OTP_CODE", "424242");
  assertEquals(isReviewerLogin("+2250700000002", "424242"), true);
  resetReviewerEnv();
});

Deno.test("isReviewerLogin: mauvais code ou numéro hors liste → false (retombe sur flux normal)", () => {
  resetReviewerEnv();
  // @ts-expect-error — Deno global
  Deno.env.set("REVIEWER_PHONE_E164", "+2250700000001");
  // @ts-expect-error — Deno global
  Deno.env.set("REVIEWER_OTP_CODE", "424242");
  assertEquals(isReviewerLogin("+2250700000001", "999999"), false);
  assertEquals(isReviewerLogin("+2250799999999", "424242"), false);
  resetReviewerEnv();
});

Deno.test("isReviewerLogin: code hors format OTP (trop court) → jamais actif", () => {
  resetReviewerEnv();
  // @ts-expect-error — Deno global
  Deno.env.set("REVIEWER_PHONE_E164", "+2250700000001");
  // @ts-expect-error — Deno global
  Deno.env.set("REVIEWER_OTP_CODE", "42");
  assertEquals(isReviewerLogin("+2250700000001", "42"), false);
  resetReviewerEnv();
});

// ---------------------------------------------------------------------------
// Retrouver un compte déjà provisionné — le bug qui enfermait tout le monde
// dehors dès la deuxième connexion.
// ---------------------------------------------------------------------------
// Ce que ces tests verrouillent : GoTrue stocke le téléphone SANS le `+`. Le
// repli `listUsers` comparait la forme E.164 telle quelle et ne trouvait donc
// jamais rien. Comme `createUser` échoue en `email_exists` pour un compte qui
// existe, ce repli est le seul chemin — d'où `user_provisioning_failed` à
// chaque retour d'un spawter.
//
// Aucun test ne l'attrapait parce qu'aucun ne rejouait une SECONDE connexion du
// même numéro. C'est le scénario, pas l'assertion, qui manquait.
import { matchesPhoneAccount } from "./index.ts";

const EMAIL_SUBSTITUT = "phone-2250700000101@phone.spawt.local";

Deno.test("matchesPhoneAccount: GoTrue stocke sans le `+` → on retrouve quand même", () => {
  // La forme exacte renvoyée par GoTrue, vérifiée sur la base réelle.
  const compte = { phone: "2250700000101", email: EMAIL_SUBSTITUT };
  assert(matchesPhoneAccount(compte, "+2250700000101", EMAIL_SUBSTITUT));
});

Deno.test("matchesPhoneAccount: forme E.164 conservée → correspond aussi", () => {
  const compte = { phone: "+2250700000101", email: EMAIL_SUBSTITUT };
  assert(matchesPhoneAccount(compte, "+2250700000101", EMAIL_SUBSTITUT));
});

Deno.test("matchesPhoneAccount: téléphone absent → l'e-mail de substitution rattrape", () => {
  // Le cas où GoTrue ne renvoie pas le téléphone : l'e-mail est déterministe,
  // et c'est précisément lui qui a provoqué le `email_exists`.
  const compte = { email: EMAIL_SUBSTITUT };
  assert(matchesPhoneAccount(compte, "+2250700000101", EMAIL_SUBSTITUT));
});

Deno.test("matchesPhoneAccount: e-mail insensible à la casse", () => {
  const compte = { email: "PHONE-2250700000101@Phone.Spawt.Local" };
  assert(matchesPhoneAccount(compte, "+2250700000101", EMAIL_SUBSTITUT));
});

Deno.test("matchesPhoneAccount: un AUTRE numéro ne correspond pas", () => {
  // Le garde-fou qui compte : élargir la correspondance ne doit jamais faire
  // ouvrir la session de quelqu'un d'autre.
  const autre = { phone: "2250700000102", email: "phone-2250700000102@phone.spawt.local" };
  assertEquals(matchesPhoneAccount(autre, "+2250700000101", EMAIL_SUBSTITUT), false);
});

Deno.test("matchesPhoneAccount: compte sans téléphone ni e-mail → refus", () => {
  assertEquals(matchesPhoneAccount({}, "+2250700000101", EMAIL_SUBSTITUT), false);
});

Deno.test("matchesPhoneAccount: numéro vide → ne matche pas un compte vide", () => {
  // Sans ce garde, `digitsOf("") === digitsOf(undefined)` serait vrai et le
  // premier compte venu ferait l'affaire.
  assertEquals(matchesPhoneAccount({ phone: "" }, "", ""), false);
});

Deno.test("matchesPhoneAccount: un préfixe n'est pas une correspondance", () => {
  const compte = { phone: "22507000001010", email: "x@y.z" };
  assertEquals(matchesPhoneAccount(compte, "+2250700000101", EMAIL_SUBSTITUT), false);
});
