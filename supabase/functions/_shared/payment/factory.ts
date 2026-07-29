// Factory provider de paiement — SPEC 4 §4.5 (switch par env, zéro refactor).
// ARBITRAGE FONDATEUR : CinetPay par défaut, remplaçable en posant
// PAYMENT_PROVIDER=<autre> + une nouvelle implémentation IPaymentProvider
// (backup identifié : Flutterwave). Les Edge Functions ne connaissent QUE
// createPaymentProvider().
//
// Envs attendues (supabase secrets set …) :
//   PAYMENT_PROVIDER          — défaut 'cinetpay'
//   CINETPAY_API_KEY          — clé API marchand
//   CINETPAY_SITE_ID          — site id marchand
//   CINETPAY_SECRET_KEY       — secret HMAC webhook
//   CINETPAY_BASE_URL         — optionnel (défaut prod)
//   PAYMENT_RETURN_BASE_URL   — base des URLs de retour portail
//                               (consommée par payment-checkout, pas ici)

import type { IPaymentProvider } from "./types.ts";
import { CinetPayProvider } from "./cinetpay.ts";

// @ts-expect-error — Deno global (runtime Supabase Edge)
declare const Deno: { env: { get(name: string): string | undefined } };

/** Erreur de configuration (secret manquant) — mappée 500 edge_misconfigured. */
export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

export function createPaymentProvider(): IPaymentProvider {
  const providerName = Deno.env.get("PAYMENT_PROVIDER") ?? "cinetpay";

  switch (providerName) {
    case "cinetpay": {
      const apiKey = Deno.env.get("CINETPAY_API_KEY");
      const siteId = Deno.env.get("CINETPAY_SITE_ID");
      const secretKey = Deno.env.get("CINETPAY_SECRET_KEY");
      if (!apiKey || !siteId || !secretKey) {
        throw new PaymentConfigError(
          "CINETPAY_API_KEY / CINETPAY_SITE_ID / CINETPAY_SECRET_KEY requis",
        );
      }
      return new CinetPayProvider({
        apiKey,
        siteId,
        secretKey,
        baseUrl: Deno.env.get("CINETPAY_BASE_URL"),
      });
    }
    default:
      throw new PaymentConfigError(`PAYMENT_PROVIDER inconnu : ${providerName}`);
  }
}
