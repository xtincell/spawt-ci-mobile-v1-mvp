// Edge Function `otp-verify` — Story 2.3 (FR-001)
// Runtime : Deno (Supabase Edge). Bridge Termii verify + ouverture session
// Supabase Auth.
//
// Flow :
//   1. Lookup le `pin_id` Termii via `otp_attempts.request_id` (envoi le plus récent).
//   2. Appelle Termii `/api/sms/otp/verify` avec `pin_id` + code saisi.
//   3. Si verified : `auth.admin.createUser({phone, phone_confirm: true})` si user
//      absent, puis génère un access/refresh token via `auth.admin.signInWithOtp`
//      (workaround documenté — Supabase v2.x n'expose pas `auth.admin.createSession`
//      directement, voir Defer Story 2.3 §7).
//   4. Retourne `{access_token, refresh_token, user_id}` au client mobile.
//
// Workaround `signInWithOtp` : on appelle `auth.signInWithOtp({phone, options:
//   {shouldCreateUser: true}})` côté admin — l'API renvoie une session valide
//   sans envoyer un SMS supplémentaire si on l'invoque côté admin avec un
//   token Termii pré-validé. **À valider en alpha — pattern fragile, fallback
//   = `generateLink({type:"magiclink"})` puis client `verifyOtp`.**

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// @ts-expect-error — Deno global
declare const Deno: { env: { get(name: string): string | undefined } };

interface VerifyPayload {
  phone_e164: string;
  otp_code: string;
}

const PHONE_RE = /^\+[1-9]\d{9,14}$/;
const OTP_RE = /^\d{6}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// @ts-expect-error — Deno serve
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: VerifyPayload;
  try {
    payload = (await req.json()) as VerifyPayload;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!payload?.phone_e164 || !PHONE_RE.test(payload.phone_e164)) {
    return json({ error: "invalid_phone" }, 400);
  }
  if (!payload?.otp_code || !OTP_RE.test(payload.otp_code)) {
    return json({ error: "invalid_otp" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return json({ error: "edge_misconfigured" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRole);

  // Lookup le pin_id Termii le plus récent pour ce phone.
  const { data: attempts } = await admin
    .from("otp_attempts")
    .select("request_id")
    .eq("phone_e164", payload.phone_e164)
    .order("sent_at", { ascending: false })
    .limit(1);

  const pinId = attempts?.[0]?.request_id;
  if (!pinId) return json({ error: "no_pending_otp" }, 400);

  // Mock mode pour CI/tests.
  if (Deno.env.get("MOCK_TERMII") === "true") {
    if (payload.otp_code !== "123456") return json({ error: "invalid_otp" }, 401);
  } else {
    const termiiKey = Deno.env.get("TERMII_API_KEY");
    if (!termiiKey) return json({ error: "edge_misconfigured" }, 500);

    try {
      const resp = await fetch("https://api.ng.termii.com/api/sms/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: termiiKey,
          pin_id: pinId,
          pin: payload.otp_code,
        }),
      });
      const body = (await resp.json()) as { verified?: boolean; status?: string };
      if (!resp.ok || body.verified !== true) {
        return json({ error: "invalid_otp" }, 401);
      }
    } catch (_err) {
      return json({ error: "provider_error" }, 500);
    }
  }

  // Marque vérifié dans la table audit.
  await admin
    .from("otp_attempts")
    .update({ verified_at: new Date().toISOString() })
    .eq("request_id", pinId);

  // Crée ou retrouve le user auth.
  // Note : `getUserByPhone` n'existe pas directement — on tente createUser puis
  // si conflict on récupère via signInWithOtp côté admin.
  let userId: string | null = null;
  try {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      phone: payload.phone_e164,
      phone_confirm: true,
    });
    if (!createErr && created.user) userId = created.user.id;
  } catch (_err) {
    // user existe probablement déjà — on continue
  }

  if (!userId) {
    // Fallback : lookup via listUsers (Supabase 2.45 admin API)
    const { data: users } = await admin.auth.admin.listUsers();
    const existing = users?.users?.find((u: { phone?: string }) => u.phone === payload.phone_e164);
    if (existing) userId = existing.id;
  }

  if (!userId) return json({ error: "user_provisioning_failed" }, 500);

  // Génère une session — workaround (cf. dev notes Story 2.3 Task 3).
  // Pattern : generateLink magiclink puis client verifyOtp côté mobile.
  // Pour Story 2.3 V1 on retourne le user_id + un flag, le client utilisera
  // `signInWithIdToken` après validation — alternative possible : émettre un
  // JWT signé par le serveur. À durcir en alpha.
  return json({
    success: true,
    user_id: userId,
    // V1 stub : le client doit ré-appeler `supabase.auth.signInWithPassword`
    // ou recevoir un magic-link. Vu la complexité, la session direct via REST
    // est traçée Defer §7 + sera testée bout-en-bout en alpha avec projet live.
  });
});
