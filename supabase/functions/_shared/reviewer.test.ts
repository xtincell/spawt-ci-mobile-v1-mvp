// Tests Deno — gate reviewer partagé (finding P2#11).
//
// Run :
//   deno test supabase/functions/_shared/reviewer.test.ts
//
// Prouve que le skip-SMS (isReviewerPhone) et le login (isReviewerLogin)
// reposent sur le MÊME prédicat isReviewerConfigured — impossible de skipper le
// SMS d'un numéro qui ne pourrait pas se loguer.

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

import {
  isReviewerConfigured,
  isReviewerLogin,
  isReviewerPhone,
} from "./reviewer.ts";

/** Fabrique un EnvReader factice depuis un objet plat. */
function env(vars: Record<string, string | undefined>) {
  return { get: (name: string) => vars[name] };
}

Deno.test("isReviewerConfigured: exige numéro ET code bien formé", () => {
  assertEquals(isReviewerConfigured(env({})), false);
  assertEquals(isReviewerConfigured(env({ REVIEWER_PHONE_E164: "+2250700000001" })), false);
  assertEquals(
    isReviewerConfigured(env({ REVIEWER_PHONE_E164: "+2250700000001", REVIEWER_OTP_CODE: "42" })),
    false, // code trop court
  );
  assertEquals(
    isReviewerConfigured(env({ REVIEWER_PHONE_E164: "+2250700000001", REVIEWER_OTP_CODE: "424242" })),
    true,
  );
});

Deno.test("isReviewerPhone (skip-SMS) et isReviewerLogin partagent le même gate (P2#11)", () => {
  // Numéro whitelisté mais AUCUN code → ni skip-SMS ni login (sinon numéro brické).
  const noCode = env({ REVIEWER_PHONE_E164: "+2250700000001" });
  assertEquals(isReviewerPhone("+2250700000001", noCode), false);
  assertEquals(isReviewerLogin("+2250700000001", "424242", noCode), false);

  // Code malformé → idem.
  const badCode = env({ REVIEWER_PHONE_E164: "+2250700000001", REVIEWER_OTP_CODE: "42" });
  assertEquals(isReviewerPhone("+2250700000001", badCode), false);
  assertEquals(isReviewerLogin("+2250700000001", "42", badCode), false);

  // Gate complet : skip-SMS actif pour le numéro whitelisté ; login OK avec le
  // bon code, KO avec un mauvais code (retombe sur flux normal).
  const ok = env({ REVIEWER_PHONE_E164: "+2250700000001, +2250700000002", REVIEWER_OTP_CODE: "424242" });
  assertEquals(isReviewerPhone("+2250700000002", ok), true);
  assertEquals(isReviewerPhone("+2250700000009", ok), false); // hors liste
  assertEquals(isReviewerLogin("+2250700000002", "424242", ok), true);
  assertEquals(isReviewerLogin("+2250700000002", "999999", ok), false); // mauvais code
  assertEquals(isReviewerLogin("+2250700000009", "424242", ok), false); // hors liste
});
