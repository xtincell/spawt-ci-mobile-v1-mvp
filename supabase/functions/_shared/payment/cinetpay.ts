// CinetPayProvider — implémentation IPaymentProvider pour CinetPay
// (agrégateur Mobile Money CI : ORANGE_MONEY_CI / WAVE_CI / MTN_MOMO_CI).
// SPEC 4 §4.2 : endpoint https://api-checkout.cinetpay.com/v2/payment,
// devise XOF, canal MOBILE_MONEY (les cartes = Phase 2).
//
// Sécurité webhook — le stub SPEC 4 (`signature.length > 0`) était
// explicitement simplifié : ici on vérifie RÉELLEMENT le header `x-token`
// (HMAC-SHA256 avec la SECRET_KEY, cf. verifyWebhookToken). Et quoi qu'il
// arrive, la RÈGLE D'OR s'applique côté Edge payment-webhook : re-confirmer
// par getStatus() avant toute activation.

import {
  type IPaymentProvider,
  type PaymentConfirmation,
  type PaymentInitiateParams,
  type PaymentInitiateResult,
  type PaymentStatus,
  type WebhookEvent,
  PaymentProviderError,
} from "./types.ts";

export interface CinetPayConfig {
  apiKey: string;
  siteId: string;
  secretKey: string;
  /** Défaut : prod. Sandbox = même host (CinetPay différencie par les clés). */
  baseUrl?: string;
  /** Injectable pour les tests (stub fetch, zéro réseau). */
  fetchImpl?: typeof fetch;
  /** Timeout des appels API (ms). */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "https://api-checkout.cinetpay.com";
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Ordre de concaténation des champs du webhook pour le HMAC `x-token`,
 * tel que documenté par CinetPay (docs.cinetpay.com, « Vérification du token
 * HMAC ») : token = HMAC-SHA256(data, SECRET_KEY) avec
 * data = cpm_site_id + cpm_trans_id + cpm_trans_date + cpm_amount +
 *        cpm_currency + signature + payment_method + cel_phone_num +
 *        cpm_phone_prefixe + cpm_language + cpm_version +
 *        cpm_payment_config + cpm_page_action + cpm_custom +
 *        cpm_designation + cpm_error_message
 *
 * ⚠️ Source d'incertitude (implémentation hors-ligne) : cet ordre vient de la
 * documentation publique CinetPay telle que connue au 2026-07 — il n'a pas pu
 * être re-vérifié contre l'API live depuis cet environnement. Si CinetPay
 * change l'ordre ou ajoute un champ, la signature sera refusée (400) : à
 * valider en sandbox AVANT la prod (runbook HUMAN_TODO). La règle d'or
 * (re-confirmation getStatus) garantit qu'aucune erreur ici ne peut activer
 * un abonnement à tort — au pire un webhook légitime est rejeté et le statut
 * est rattrapé par polling portail / cron.
 */
const WEBHOOK_HMAC_FIELDS = [
  "cpm_site_id",
  "cpm_trans_id",
  "cpm_trans_date",
  "cpm_amount",
  "cpm_currency",
  "signature",
  "payment_method",
  "cel_phone_num",
  "cpm_phone_prefixe",
  "cpm_language",
  "cpm_version",
  "cpm_payment_config",
  "cpm_page_action",
  "cpm_custom",
  "cpm_designation",
  "cpm_error_message",
] as const;

/** HMAC-SHA256 hex via Web Crypto (API standard Deno — pas de dépendance). */
export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparaison constant-time (anti timing attack) sur strings hex. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Concatène les champs webhook dans l'ordre HMAC documenté (absent = ""). */
export function buildWebhookHmacData(body: Record<string, string>): string {
  return WEBHOOK_HMAC_FIELDS.map((f) => body[f] ?? "").join("");
}

/** Mapping statuts CinetPay → vocabulaire interne. Inconnu → pending (on
 *  n'active ni ne refuse jamais sur un statut qu'on ne comprend pas). */
export function mapCinetPayStatus(
  dataStatus: string | undefined,
  code: string | undefined,
): PaymentStatus {
  const s = (dataStatus ?? "").toUpperCase();
  if (s === "ACCEPTED") return "accepted";
  if (s === "REFUSED") return "refused";
  if (s === "PENDING" || s === "WAITING_FOR_CUSTOMER" || s === "WAITING_CUSTOMER_PAYMENT") {
    return "pending";
  }
  // Fallback sur le code global si data.status absent.
  if (code === "00") return "accepted";
  if (code === "600" || code === "627") return "refused"; // PAYMENT_FAILED / TRANSACTION_CANCEL
  return "pending";
}

interface CinetPayEnvelope {
  code?: string;
  message?: string;
  description?: string;
  data?: Record<string, unknown>;
}

export class CinetPayProvider implements IPaymentProvider {
  readonly name = "cinetpay";
  private readonly config: Required<Pick<CinetPayConfig, "apiKey" | "siteId" | "secretKey">> & {
    baseUrl: string;
    fetchImpl: typeof fetch;
    timeoutMs: number;
  };

  constructor(config: CinetPayConfig) {
    this.config = {
      apiKey: config.apiKey,
      siteId: config.siteId,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      fetchImpl: config.fetchImpl ?? fetch,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<CinetPayEnvelope> {
    let resp: Response;
    try {
      resp = await this.config.fetchImpl(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err) {
      const name = (err as { name?: string }).name;
      throw new PaymentProviderError(
        this.name,
        name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error",
      );
    }
    let body: CinetPayEnvelope;
    try {
      body = (await resp.json()) as CinetPayEnvelope;
    } catch {
      throw new PaymentProviderError(this.name, `invalid_json_response_http_${resp.status}`);
    }
    return body;
  }

  async initiate(params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
    // Contrat /v2/payment (SPEC 4 §4.2) — montant TTC entier XOF, canal
    // MOBILE_MONEY (Orange/Wave/MTN résolus par CinetPay côté checkout).
    const body = await this.post("/v2/payment", {
      apikey: this.config.apiKey,
      site_id: this.config.siteId,
      transaction_id: params.transactionId,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      channels: "MOBILE_MONEY",
      customer_name: params.customerName,
      customer_phone_number: params.customerPhone,
      ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
      metadata: JSON.stringify(params.metadata ?? {}),
    });

    // '201' = CREATED (checkout généré). Tout autre code = échec d'initiation.
    const paymentUrl = body.data?.payment_url;
    if (body.code !== "201" || typeof paymentUrl !== "string" || paymentUrl.length === 0) {
      throw new PaymentProviderError(
        this.name,
        `initiate_failed code=${body.code ?? "?"} message=${body.message ?? "?"}`,
      );
    }
    return {
      transactionId: params.transactionId,
      paymentUrl,
      rawResponse: body,
    };
  }

  async getStatus(transactionId: string): Promise<PaymentConfirmation> {
    // /v2/payment/check — source de vérité server-to-server (règle d'or).
    const body = await this.post("/v2/payment/check", {
      apikey: this.config.apiKey,
      site_id: this.config.siteId,
      transaction_id: transactionId,
    });
    const data = body.data ?? {};
    return {
      transactionId,
      status: mapCinetPayStatus(
        typeof data.status === "string" ? data.status : undefined,
        body.code,
      ),
      amount: typeof data.amount === "number" ? data.amount : Number(data.amount ?? 0) || 0,
      currency: typeof data.currency === "string" ? data.currency : "XOF",
      paidAt: typeof data.payment_date === "string" ? data.payment_date : null,
      paymentMethod:
        typeof data.payment_method === "string" && data.payment_method.length > 0
          ? data.payment_method
          : null,
      rawResponse: body,
    };
  }

  async parseWebhook(headers: Headers, body: Record<string, string>): Promise<WebhookEvent> {
    const token = headers.get("x-token") ?? "";
    let signatureValid = false;
    if (token.length > 0) {
      const expected = await hmacSha256Hex(this.config.secretKey, buildWebhookHmacData(body));
      signatureValid = timingSafeEqualHex(expected.toLowerCase(), token.toLowerCase());
    }

    // Statut ANNONCÉ (indicatif seulement — jamais décisionnel) : CinetPay ne
    // met pas de champ status dans le webhook, cpm_error_message porte
    // 'SUCCES' ou le code d'erreur.
    const errMsg = (body.cpm_error_message ?? "").toUpperCase();
    const announcedStatus =
      errMsg === "SUCCES" || errMsg === "SUCCESS"
        ? ("accepted" as const)
        : errMsg.length > 0
          ? ("refused" as const)
          : null;

    return {
      signatureValid,
      transactionId:
        typeof body.cpm_trans_id === "string" && body.cpm_trans_id.length > 0
          ? body.cpm_trans_id
          : null,
      announcedStatus,
      rawBody: body,
    };
  }
}
