// Couche paiement — contrat provider-agnostique (SPEC 4 §4.1, brainstorming
// 2026-04-07). ARBITRAGE FONDATEUR : CinetPay est remplaçable sans
// refactoring (backup identifié : Flutterwave). Toute la logique métier des
// Edge Functions (checkout, webhook, cron) ne parle QUE cette interface —
// jamais l'API CinetPay directement.
//
// Différences assumées vs le stub SPEC 4 :
//   - `refund` ABSENT de l'interface : CinetPay n'expose pas d'endpoint de
//     remboursement API stable côté marchand (le refund passe par le
//     dashboard marchand / support CinetPay — cf. SPEC 4 §4.6 "Remboursement
//     demandé → Manuel"). L'ajouter avec un fetch vers un endpoint non
//     documenté serait un mensonge d'API. Si un provider futur (Flutterwave)
//     le supporte proprement, on étendra l'interface à ce moment-là.
//   - `parseWebhook` est async : la vérification HMAC passe par Web Crypto
//     (crypto.subtle), API asynchrone en Deno.

/** Plans Gold vendus via le portail web (jamais in-app — Apple 3.1.3). */
export type GoldPlan = "gold_monthly" | "gold_annual";

/**
 * Tarifs Gold — montants HT en XOF entiers (pas de centimes en francs CFA).
 * TVA CI 18 % (SPEC 4 §4.7) : le montant envoyé au provider est le TTC.
 *   gold_monthly : 2 500 HT → 2 950 TTC
 *   gold_annual  : 25 000 HT → 29 500 TTC (2 mois offerts vs 12 × 2 500)
 * NB : le seed plans (0001_seed_currencies_plans.sql) porte 22 000 HT pour
 * l'annuel — écart historique à réconcilier côté produit ; la source de
 * vérité du checkout est CE fichier (arbitrage fondateur 25 000 HT).
 */
export const TVA_RATE = 18;

export const GOLD_PLAN_PRICING: Record<
  GoldPlan,
  { price_ht: number; months: number; description: string }
> = {
  gold_monthly: { price_ht: 2500, months: 1, description: "Spawter Gold — 1 mois" },
  gold_annual: { price_ht: 25000, months: 12, description: "Spawter Gold — 12 mois" },
};

export function isGoldPlan(value: unknown): value is GoldPlan {
  return value === "gold_monthly" || value === "gold_annual";
}

/** TTC = HT + TVA arrondie au franc (round half-up, aligné trigger invoices 0032). */
export function computeTtc(priceHt: number, tvaRate: number = TVA_RATE): number {
  return priceHt + Math.round((priceHt * tvaRate) / 100);
}

/** Statuts normalisés — vocabulaire interne, jamais celui du provider. */
export type PaymentStatus = "accepted" | "refused" | "pending";

export interface PaymentInitiateParams {
  /** ID de transaction GÉNÉRÉ PAR NOUS (format SPAWT-TX-<uuid>) — clé d'idempotence. */
  transactionId: string;
  /** Montant TTC en XOF, entier. */
  amount: number;
  currency: string;
  description: string;
  /** Téléphone E.164 du spawter — obligatoire pour le Mobile Money. */
  customerPhone: string;
  customerName: string;
  customerEmail?: string;
  /** URL de retour navigateur post-paiement (portail). */
  returnUrl: string;
  /** URL du webhook serveur (Edge payment-webhook). */
  notifyUrl: string;
  metadata?: Record<string, string>;
}

export interface PaymentInitiateResult {
  transactionId: string;
  /** URL de paiement hébergée par le provider (redirect navigateur). */
  paymentUrl: string;
  /** Réponse brute provider — logs/debug uniquement, jamais de décision métier dessus. */
  rawResponse?: unknown;
}

export interface PaymentConfirmation {
  transactionId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt: string | null;
  /** ex : ORANGE_MONEY_CI, WAVE_CI, MTN_MOMO_CI. */
  paymentMethod: string | null;
  rawResponse?: unknown;
}

/** Webhook parsé + authentifié (signature vérifiée par le provider impl). */
export interface WebhookEvent {
  /** Signature valide ? Si false, on répond 400 et on ne traite RIEN. */
  signatureValid: boolean;
  /** Notre transaction_id (SPAWT-TX-…) si le payload en portait un. */
  transactionId: string | null;
  /** Statut ANNONCÉ par le webhook — indicatif SEULEMENT (règle d'or ci-dessous). */
  announcedStatus: PaymentStatus | null;
  rawBody: Record<string, string>;
}

/**
 * Contrat provider. RÈGLE D'OR (SPEC 4 + arbitrage sécurité) : le webhook ne
 * fait JAMAIS foi seul — même signature valide, toute activation passe par une
 * re-confirmation `getStatus()` (server-to-server) avant d'écrire en base.
 */
export interface IPaymentProvider {
  /** Nom du provider (logs structurés). */
  readonly name: string;

  /** Initie un paiement, retourne l'URL de checkout hébergée. */
  initiate(params: PaymentInitiateParams): Promise<PaymentInitiateResult>;

  /** Statut serveur-à-serveur d'une transaction (source de vérité). */
  getStatus(transactionId: string): Promise<PaymentConfirmation>;

  /** Parse + authentifie un webhook entrant (signature HMAC). */
  parseWebhook(headers: Headers, body: Record<string, string>): Promise<WebhookEvent>;
}

/** Erreur provider normalisée — les Edge Functions la mappent vers 502. */
export class PaymentProviderError extends Error {
  readonly providerName: string;
  constructor(providerName: string, message: string) {
    super(message);
    this.name = "PaymentProviderError";
    this.providerName = providerName;
  }
}
