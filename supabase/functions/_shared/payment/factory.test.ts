// Tests Deno — factory createPaymentProvider (switch env, fail-fast config).
//
// Run :
//   deno test --allow-env supabase/functions/_shared/payment/factory.test.ts

import { assertEquals, assertThrows } from "https://deno.land/std@0.220.0/assert/mod.ts";

import { createPaymentProvider, PaymentConfigError } from "./factory.ts";

function resetEnv() {
  Deno.env.delete("PAYMENT_PROVIDER");
  Deno.env.delete("CINETPAY_API_KEY");
  Deno.env.delete("CINETPAY_SITE_ID");
  Deno.env.delete("CINETPAY_SECRET_KEY");
  Deno.env.delete("CINETPAY_BASE_URL");
}

Deno.test("factory: défaut cinetpay quand les 3 secrets sont posés", () => {
  resetEnv();
  Deno.env.set("CINETPAY_API_KEY", "k");
  Deno.env.set("CINETPAY_SITE_ID", "s");
  Deno.env.set("CINETPAY_SECRET_KEY", "sec");
  const provider = createPaymentProvider();
  assertEquals(provider.name, "cinetpay");
  resetEnv();
});

Deno.test("factory: secret manquant → PaymentConfigError", () => {
  resetEnv();
  Deno.env.set("CINETPAY_API_KEY", "k");
  // SITE_ID + SECRET_KEY absents.
  assertThrows(() => createPaymentProvider(), PaymentConfigError);
  resetEnv();
});

Deno.test("factory: PAYMENT_PROVIDER inconnu → PaymentConfigError", () => {
  resetEnv();
  Deno.env.set("PAYMENT_PROVIDER", "paypal");
  assertThrows(() => createPaymentProvider(), PaymentConfigError);
  resetEnv();
});
