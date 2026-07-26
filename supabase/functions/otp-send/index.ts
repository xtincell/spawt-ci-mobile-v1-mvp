// Edge Function `otp-send` — Story 2.3 (FR-001)
// Runtime : Deno (Supabase Edge). Bridge Termii API + rate-limit serveur.
//
// Pattern : architecture.md §Authentication & Security.
// Secrets attendus côté Supabase Edge env :
//   TERMII_API_KEY       — clé Termii (jamais committée)
//   TERMII_SENDER_ID     — sender ID Termii ("SPAWT" ou équivalent approuvé)
//   ALLOWED_ORIGINS      — CSV des origins web autorisées (P-11)
//   SUPABASE_URL         — injecté par défaut
//   SUPABASE_SERVICE_ROLE_KEY — injecté par défaut
//
// Mode MOCK (phase MAJ consolidée 07/2026 — décision produit #V07) :
// cette phase tourne SANS compte Termii. Le mode mock est actif si
// `MOCK_TERMII=true`, OU par défaut quand ni `MOCK_TERMII` ni `TERMII_API_KEY`
// ne sont configurés — un déploiement sans secrets fonctionne donc en mock.
// En mock : retourne `{success:true, request_id:"mock-..."}` sans SMS ; le code
// attendu côté otp-verify est `123456`.
//
// Bascule SMS réel (phase suivante, NE PAS câbler maintenant) :
//   supabase secrets set TERMII_API_KEY=... MOCK_TERMII=false
//
// Déploiement :
//   supabase functions deploy otp-send

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { isReviewerPhone as isReviewerPhoneShared } from "../_shared/reviewer.ts";

// @ts-expect-error — Deno global
declare const Deno: { env: { get(name: string): string | undefined }; serve: (h: (req: Request) => Promise<Response> | Response) => void };

interface SendPayload {
  phone_e164: string;
}

// P8 — aligné avec migration 0009 (^\+[1-9]\d{8,14}$).
const PHONE_RE = /^\+[1-9]\d{8,14}$/;
const RATE_LIMIT_PHONE_PER_HOUR = 5;
const RATE_LIMIT_IP_PER_HOUR = 20;

// #V07 — mock par défaut tant que le SMS réel n'est pas configuré :
// `MOCK_TERMII=true` force le mock, `MOCK_TERMII=false` force le live,
// non défini → mock si aucune clé Termii n'existe.
function isMockMode(): boolean {
  const flag = Deno.env.get("MOCK_TERMII");
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !Deno.env.get("TERMII_API_KEY");
}

// Review stores — numéros whitelistés (env REVIEWER_PHONE_E164, CSV) : aucun
// SMS envoyé même en mode live (le reviewer Apple/Google valide avec le code
// fixe REVIEWER_OTP_CODE côté otp-verify). Les rate limits et l'audit
// otp_attempts s'appliquent normalement.
//
// finding P2#11 — le skip-SMS repose sur le MÊME prédicat que le login
// (`_shared/reviewer.ts`) : on ne prive un numéro de SMS QUE si le chemin
// reviewer est réellement exploitable (REVIEWER_OTP_CODE posé et bien formé),
// sinon le numéro serait brické (ni SMS, ni code reviewer). Wrapper Deno.env
// pour garder la signature testée `isReviewerPhone(phone)`.
export function isReviewerPhone(phoneE164: string): boolean {
  return isReviewerPhoneShared(phoneE164, Deno.env);
}

// P-11 — CORS restreint via `ALLOWED_ORIGINS` (CSV). Pas de wildcard `*` car
// `authorization` est dans `allow-headers` et un browser tier pourrait alors
// brûler le quota SMS d'une victime.
function readAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return [];
  return raw.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = readAllowedOrigins();
  const origin = req.headers.get("origin");
  // P-09 — Une origin inconnue (ou absente) ne doit JAMAIS être reflétée par
  // `allowed[0]` : ça crée un header CORS contradictoire (le browser bloque,
  // mais on a quand même répondu une whitelisted origin au mauvais demandeur).
  // On retourne toujours `"null"` pour toute origin non-whitelistée.
  const reflect = origin && allowed.includes(origin) ? origin : "null";
  return {
    "access-control-allow-origin": reflect,
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
}

function json(body: unknown, req: Request, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST, OPTIONS", ...corsHeaders(req) },
    });
  }

  let payload: SendPayload;
  try {
    payload = (await req.json()) as SendPayload;
  } catch {
    return json({ error: "invalid_json" }, req, 400);
  }

  if (!payload?.phone_e164 || !PHONE_RE.test(payload.phone_e164)) {
    return json({ error: "invalid_phone" }, req, 400);
  }

  // P5 — Prioriser les headers IP des proxies trusted (Cloudflare, reverse-proxy)
  // avant le `x-forwarded-for` qui est trivialement spoofable côté client.
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return json({ error: "edge_misconfigured" }, req, 500);
  }
  const admin = createClient(supabaseUrl, serviceRole);

  // Story 6.4 — refuse les comptes bannis (is_banned = true).
  // Vérification AVANT le rate-limit pour ne pas consommer un slot pour rien.
  const { data: spawter } = await admin
    .from("spawters")
    .select("is_banned")
    .eq("phone_e164", payload.phone_e164)
    .maybeSingle();
  if (spawter?.is_banned) {
    // CR Chunk B C5 — format conforme spec Story 6.4 AC #7 : {code, message}
    // structuré pour que le mobile (Story 2.3 handler) distingue le code i18n.
    return json(
      {
        error: {
          code: "ACCOUNT_BANNED",
          message: "Compte suspendu. Contactez le support si vous pensez qu'il s'agit d'une erreur.",
        },
      },
      req,
      403,
    );
  }

  // Rate-limit : count des envois de la dernière heure.
  // P-07 — Si la query Supabase échoue (RLS bug, table absente, transient), on
  // ne peut pas garantir le rate-limit → reject 500 plutôt que de laisser passer
  // un bypass silencieux (le `?? 0` aurait accepté l'envoi).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: phoneCount, error: phoneCountErr } = await admin
    .from("otp_attempts")
    .select("*", { count: "exact", head: true })
    .eq("phone_e164", payload.phone_e164)
    .gte("sent_at", oneHourAgo);

  if (phoneCountErr) {
    return json({ error: "rate_limit_check_failed", detail: phoneCountErr.message }, req, 500);
  }
  if ((phoneCount ?? 0) >= RATE_LIMIT_PHONE_PER_HOUR) {
    return json({ error: "rate_limited", scope: "phone", retry_after_seconds: 3600 }, req, 429);
  }

  if (ip) {
    const { count: ipCount, error: ipCountErr } = await admin
      .from("otp_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("sent_at", oneHourAgo);
    if (ipCountErr) {
      return json({ error: "rate_limit_check_failed", detail: ipCountErr.message }, req, 500);
    }
    if ((ipCount ?? 0) >= RATE_LIMIT_IP_PER_HOUR) {
      return json({ error: "rate_limited", scope: "ip", retry_after_seconds: 3600 }, req, 429);
    }
  }

  // Review stores — numéro whitelisté : audit normal, zéro SMS (même en live).
  // La validation se fait côté otp-verify avec REVIEWER_OTP_CODE.
  if (isReviewerPhone(payload.phone_e164)) {
    const reviewerId = `reviewer-${Date.now()}`;
    const { error: insertError } = await admin
      .from("otp_attempts")
      .insert({ phone_e164: payload.phone_e164, ip, request_id: reviewerId });
    if (insertError) {
      return json({ error: "audit_insert_failed", detail: insertError.message }, req, 500);
    }
    return json({ success: true, request_id: reviewerId }, req);
  }

  // Mock mode (défaut de cette phase) — aucun SMS, aucun appel Termii.
  if (isMockMode()) {
    const mockId = `mock-${Date.now()}`;
    // P-10 — check insertError, sinon SMS sent / DB row absent silencieusement.
    const { error: insertError } = await admin
      .from("otp_attempts")
      .insert({ phone_e164: payload.phone_e164, ip, request_id: mockId });
    if (insertError) {
      return json({ error: "audit_insert_failed", detail: insertError.message }, req, 500);
    }
    return json({ success: true, request_id: mockId }, req);
  }

  const termiiKey = Deno.env.get("TERMII_API_KEY");
  const termiiSender = Deno.env.get("TERMII_SENDER_ID") ?? "SPAWT";
  if (!termiiKey) return json({ error: "edge_misconfigured" }, req, 500);

  // P-08 — Timeout 10s sur le fetch Termii : sans ça, l'Edge Function attend
  // jusqu'au cap Supabase (60s) et le user voit un network error tardif tandis
  // que le quota Termii peut être consommé partiellement.
  const TERMII_TIMEOUT_MS = 10_000;
  let termiiResp: { pinId?: string; message?: string };
  try {
    const resp = await fetch("https://api.ng.termii.com/api/sms/otp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: termiiKey,
        message_type: "NUMERIC",
        to: payload.phone_e164,
        from: termiiSender,
        channel: "dnd",
        pin_attempts: 3,
        pin_time_to_live: 5,
        pin_length: 6,
        pin_placeholder: "< 1234 >",
        message_text: "Ton code SPAWT : < 1234 >",
        pin_type: "NUMERIC",
      }),
      signal: AbortSignal.timeout(TERMII_TIMEOUT_MS),
    });
    termiiResp = (await resp.json()) as { pinId?: string; message?: string };
    if (!resp.ok || !termiiResp.pinId) {
      return json({ error: "provider_error", detail: termiiResp.message }, req, 500);
    }
  } catch (err) {
    const isTimeout = (err as { name?: string }).name === "TimeoutError" || (err as { name?: string }).name === "AbortError";
    return json(
      { error: isTimeout ? "provider_timeout" : "provider_error" },
      req,
      isTimeout ? 504 : 500,
    );
  }

  // P-10 — même garde pour le path Termii live.
  const { error: insertError } = await admin
    .from("otp_attempts")
    .insert({ phone_e164: payload.phone_e164, ip, request_id: termiiResp.pinId });
  if (insertError) {
    return json({ error: "audit_insert_failed", detail: insertError.message }, req, 500);
  }

  return json({ success: true, request_id: termiiResp.pinId }, req);
}

Deno.serve(handleRequest);
