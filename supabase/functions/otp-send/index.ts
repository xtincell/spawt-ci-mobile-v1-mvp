// Edge Function `otp-send` — Story 2.3 (FR-001)
// Runtime : Deno (Supabase Edge). Bridge Termii API + rate-limit serveur.
//
// Pattern : architecture.md §Authentication & Security.
// Secrets attendus côté Supabase Edge env :
//   TERMII_API_KEY       — clé Termii (jamais committée)
//   TERMII_SENDER_ID     — sender ID Termii ("SPAWT" ou équivalent approuvé)
//   SUPABASE_URL         — injecté par défaut
//   SUPABASE_SERVICE_ROLE_KEY — injecté par défaut
//
// Mode test : si env `MOCK_TERMII=true`, retourne `{success:true, request_id:"mock-..."}`.
// Utile en CI sans frapper l'API Termii réelle (cohérent défer Story 2.3 #5).
//
// Déploiement :
//   supabase functions deploy otp-send
//   supabase secrets set TERMII_API_KEY=...

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// @ts-expect-error — Deno global
declare const Deno: { env: { get(name: string): string | undefined } };

interface SendPayload {
  phone_e164: string;
}

const PHONE_RE = /^\+[1-9]\d{9,14}$/;
const RATE_LIMIT_PHONE_PER_HOUR = 5;
const RATE_LIMIT_IP_PER_HOUR = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// @ts-expect-error — Deno serve
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: SendPayload;
  try {
    payload = (await req.json()) as SendPayload;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!payload?.phone_e164 || !PHONE_RE.test(payload.phone_e164)) {
    return json({ error: "invalid_phone" }, 400);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return json({ error: "edge_misconfigured" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRole);

  // Rate-limit : count des envois de la dernière heure.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: phoneCount } = await admin
    .from("otp_attempts")
    .select("*", { count: "exact", head: true })
    .eq("phone_e164", payload.phone_e164)
    .gte("sent_at", oneHourAgo);

  if ((phoneCount ?? 0) >= RATE_LIMIT_PHONE_PER_HOUR) {
    return json({ error: "rate_limited", scope: "phone", retry_after_seconds: 3600 }, 429);
  }

  if (ip) {
    const { count: ipCount } = await admin
      .from("otp_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("sent_at", oneHourAgo);
    if ((ipCount ?? 0) >= RATE_LIMIT_IP_PER_HOUR) {
      return json({ error: "rate_limited", scope: "ip", retry_after_seconds: 3600 }, 429);
    }
  }

  // Mock mode pour CI/tests sans appeler Termii.
  if (Deno.env.get("MOCK_TERMII") === "true") {
    const mockId = `mock-${Date.now()}`;
    await admin
      .from("otp_attempts")
      .insert({ phone_e164: payload.phone_e164, ip, request_id: mockId });
    return json({ success: true, request_id: mockId });
  }

  const termiiKey = Deno.env.get("TERMII_API_KEY");
  const termiiSender = Deno.env.get("TERMII_SENDER_ID") ?? "SPAWT";
  if (!termiiKey) return json({ error: "edge_misconfigured" }, 500);

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
    });
    termiiResp = (await resp.json()) as { pinId?: string; message?: string };
    if (!resp.ok || !termiiResp.pinId) {
      return json({ error: "provider_error", detail: termiiResp.message }, 500);
    }
  } catch (_err) {
    return json({ error: "provider_error" }, 500);
  }

  await admin
    .from("otp_attempts")
    .insert({ phone_e164: payload.phone_e164, ip, request_id: termiiResp.pinId });

  return json({ success: true, request_id: termiiResp.pinId });
});
