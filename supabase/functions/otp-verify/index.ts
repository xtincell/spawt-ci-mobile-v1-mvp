// Edge Function `otp-verify` — Story 2.3a (FR-001)
// Runtime : Deno (Supabase Edge). Bridge Termii verify + ouverture session
// Supabase Auth bout-en-bout.
//
// Flow :
//   1. Lookup le `pin_id` Termii via `otp_attempts.request_id` (envoi le plus récent).
//   2. Appelle Termii `/api/sms/otp/verify` avec `pin_id` + code saisi.
//   3. Si verified : burn le pin (anti-replay P3), puis provision le user via
//      `admin.createUser({phone, email: <synth>, phone_confirm, email_confirm})`
//      OU lookup existant via listUsers + updateUserById si email manquant.
//      P-07 — Si provisioning échoue, on UN-burn pour permettre une nouvelle
//      tentative (compensation : choix replay-risk vs user-locked-out).
//   4. Émet une vraie session Supabase via `admin.generateLink({type:'magiclink'})`
//      → extraction `hashed_token` → `anonClient.verifyOtp({token_hash, type:'magiclink'})`
//      qui retourne `{access_token, refresh_token}` issued par GoTrue (lifecycle
//      complet, refresh natif côté SDK mobile).
//   5. Retourne `{access_token, refresh_token, user_id}` au client mobile pour
//      `supabase.auth.setSession({...})` (Story 2.3a AC #3).
//
// Pourquoi pas JWT signing direct (HS256 + SUPABASE_JWT_SECRET) : un refresh_token
// fabriqué côté Edge ne serait pas connu de GoTrue → après expiration access_token
// (1h), le SDK appellerait /token?grant_type=refresh_token avec 401 → logout
// silencieux. Le pattern generateLink+verifyOtp donne des tokens dans la table
// `auth.refresh_tokens` officielle, donc refresh natif.
//
// Email synthétique : `phone-<userId>@phone.spawt.local` — requis par GoTrue
// pour magiclink. Non exposé à l'utilisateur, jamais utilisé pour envoyer un
// email réel (magiclink est consommé immédiatement server-side).

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// @ts-expect-error — Deno global
declare const Deno: { env: { get(name: string): string | undefined }; serve: (h: (req: Request) => Promise<Response> | Response) => void };

interface VerifyPayload {
  phone_e164: string;
  otp_code: string;
}

// P8 — aligné avec migration 0009 (^\+[1-9]\d{8,14}$).
const PHONE_RE = /^\+[1-9]\d{8,14}$/;
const OTP_RE = /^\d{6}$/;

// P-11 — CORS restreint : la liste blanche est lue depuis `ALLOWED_ORIGINS`
// (CSV). Si vide, on échoue closed (deny). Reflète exactement l'origine de la
// requête (jamais `*`) pour empêcher le bypass cross-origin avec credentials.
function readAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return [];
  return raw.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = readAllowedOrigins();
  const origin = req.headers.get("origin");
  // P-09 round 3 — fallback `allowed[0]` retourne une whitelisted origin au
  // mauvais demandeur ; on retourne toujours `"null"` pour toute origin non-
  // whitelistée. Browser bloque proprement le préflight.
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

function synthEmailForUser(userId: string): string {
  return `phone-${userId.replace(/-/g, "")}@phone.spawt.local`;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST, OPTIONS", ...corsHeaders(req) },
    });
  }

  let payload: VerifyPayload;
  try {
    payload = (await req.json()) as VerifyPayload;
  } catch {
    return json({ error: "invalid_json" }, req, 400);
  }

  if (!payload?.phone_e164 || !PHONE_RE.test(payload.phone_e164)) {
    return json({ error: "invalid_phone" }, req, 400);
  }
  if (!payload?.otp_code || !OTP_RE.test(payload.otp_code)) {
    return json({ error: "invalid_otp" }, req, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRole || !anonKey) {
    return json({ error: "edge_misconfigured" }, req, 500);
  }
  const admin = createClient(supabaseUrl, serviceRole);

  // P3 — Lookup le pin_id Termii le plus récent NON ENCORE VÉRIFIÉ pour ce phone.
  const { data: attempts } = await admin
    .from("otp_attempts")
    .select("request_id")
    .eq("phone_e164", payload.phone_e164)
    .is("verified_at", null)
    .order("sent_at", { ascending: false })
    .limit(1);

  const pinId = attempts?.[0]?.request_id;
  if (!pinId) return json({ error: "no_pending_otp" }, req, 400);

  // Mock mode pour CI/tests : skip Termii API, accepte 123456 universel.
  if (Deno.env.get("MOCK_TERMII") === "true") {
    if (payload.otp_code !== "123456") return json({ error: "invalid_otp" }, req, 401);
  } else {
    const termiiKey = Deno.env.get("TERMII_API_KEY");
    if (!termiiKey) return json({ error: "edge_misconfigured" }, req, 500);

    // P-08 round 3 — Timeout 10s sur le fetch Termii verify : sans ça, l'Edge
    // attend jusqu'au cap Supabase (60s) si Termii hang → user voit network
    // error tardif et la fenêtre 5min OTP peut expirer entretemps.
    const TERMII_TIMEOUT_MS = 10_000;
    try {
      const resp = await fetch("https://api.ng.termii.com/api/sms/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: termiiKey,
          pin_id: pinId,
          pin: payload.otp_code,
        }),
        signal: AbortSignal.timeout(TERMII_TIMEOUT_MS),
      });
      const body = (await resp.json()) as { verified?: boolean; status?: string };
      if (!resp.ok || body.verified !== true) {
        return json({ error: "invalid_otp" }, req, 401);
      }
    } catch (err) {
      const isTimeout = (err as { name?: string }).name === "TimeoutError" || (err as { name?: string }).name === "AbortError";
      return json(
        { error: isTimeout ? "provider_timeout" : "provider_error" },
        req,
        isTimeout ? 504 : 500,
      );
    }
  }

  // P3 — Burn atomique du pin pour anti-replay.
  // P-07 — Si la suite (provisioning user / émission session) échoue, on
  // un-burn pour permettre une nouvelle tentative sans relancer le SMS.
  const { data: burned } = await admin
    .from("otp_attempts")
    .update({ verified_at: new Date().toISOString() })
    .eq("request_id", pinId)
    .is("verified_at", null)
    .select("request_id");
  if (!burned || burned.length === 0) {
    return json({ error: "otp_already_used" }, req, 400);
  }

  const unburn = async (): Promise<void> => {
    // P-11 round 3 — Si l'un-burn échoue (Supabase transient, perm), le pinId
    // reste burned et le user est lock out sans rétroaction. On log au minimum
    // pour ne pas perdre le signal en cas d'incident.
    const { error: unburnErr } = await admin
      .from("otp_attempts")
      .update({ verified_at: null })
      .eq("request_id", pinId);
    if (unburnErr) {
      console.warn("[otp-verify] unburn failed for pinId", pinId, unburnErr.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Provision le user auth (création ou lookup) — Story 2.3a AC #3.
  // ---------------------------------------------------------------------------
  let userId: string | null = null;
  let userHasEmail = false;

  const placeholderEmail = `phone-${payload.phone_e164.replace(/[^0-9]/g, "")}@phone.spawt.local`;

  // P-09 — distinguer les erreurs createUser transitoires (rate limit, 5xx)
  // des erreurs "user existe déjà" (continue → listUsers OK). Une transient
  // → return 500 explicite + un-burn (P-07).
  try {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      phone: payload.phone_e164,
      email: placeholderEmail,
      phone_confirm: true,
      email_confirm: true,
    });
    if (createErr) {
      const code = (createErr as { code?: string; status?: number }).code ?? "";
      const status = (createErr as { code?: string; status?: number }).status;
      const isDuplicate =
        code === "user_already_exists" ||
        code === "email_address_invalid" ||
        code === "phone_exists" ||
        code === "email_exists";
      // P-10 round 3 — Si l'erreur n'a ni `code` ni `status` (e.g. CrashedRPC,
      // network glitch SDK), on tombait en `else` (continue vers listUsers
      // fallback) en croyant que c'est un duplicate. On détecte ce cas via
      // l'absence des deux champs ET un message qui sent le transient.
      const msg = (createErr as { message?: string }).message ?? "";
      const looksTransient =
        /timeout|network|fetch|ECONN|temporarily/i.test(msg) ||
        (code === "" && typeof status !== "number");
      const isTransient =
        !isDuplicate &&
        (typeof status === "number" ? status >= 500 || status === 429 : looksTransient);
      if (isTransient) {
        await unburn();
        return json({ error: "provisioning_transient_error", detail: createErr.message }, req, 500);
      }
      // sinon (duplicate ou erreur non transitoire connue) → continue vers listUsers fallback.
    } else if (created.user) {
      userId = created.user.id;
      userHasEmail = Boolean(created.user.email);
    }
  } catch (err) {
    // Erreur réseau / SDK : potentiellement transitoire, on un-burn et signale.
    await unburn();
    return json({
      error: "provisioning_transient_error",
      detail: (err as { message?: string }).message,
    }, req, 500);
  }

  if (!userId) {
    // P6 — Fallback : lookup paginé (cap 1000 ; au-delà bascule SQL direct).
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users?.users?.find(
      (u: { phone?: string; email?: string }) => u.phone === payload.phone_e164,
    );
    if (existing) {
      userId = existing.id;
      userHasEmail = Boolean(existing.email);
    }
  }

  if (!userId) {
    await unburn();
    return json({ error: "user_provisioning_failed" }, req, 500);
  }

  // S'assure que le user a un email (requis par magiclink). Si pas encore
  // (user créé pre-2.3a sans synth email), patch via updateUserById.
  // P-06 round 3 — Si l'update échoue (email collision, perm RLS, transient),
  // on continuait avec un user sans email → generateLink throwait derrière avec
  // une erreur générique. On detecte ici et un-burn explicit pour diagnostic.
  if (!userHasEmail) {
    const synth = synthEmailForUser(userId);
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      email: synth,
      email_confirm: true,
    });
    if (updateErr) {
      await unburn();
      return json({
        error: "session_provisioning_failed",
        detail: `user_email_update_failed: ${updateErr.message}`,
      }, req, 500);
    }
  }

  // ---------------------------------------------------------------------------
  // Émission de session via generateLink magiclink + verifyOtp server-side.
  // ---------------------------------------------------------------------------
  const linkEmail = userHasEmail
    ? // Récupère l'email actuel (peut être synth ou réel)
      (await admin.auth.admin.getUserById(userId)).data.user?.email
    : synthEmailForUser(userId);

  if (!linkEmail) {
    await unburn();
    return json({ error: "session_provisioning_failed" }, req, 500);
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: linkEmail,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    await unburn();
    return json({
      error: "session_provisioning_failed",
      detail: linkErr?.message,
    }, req, 500);
  }

  // Client anon pour verifier le magiclink server-side (obtenir une session
  // émise officiellement par GoTrue avec refresh_token enregistré en DB).
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: verifyData, error: verifyErr } = await anonClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !verifyData?.session) {
    await unburn();
    return json({
      error: "session_provisioning_failed",
      detail: verifyErr?.message,
    }, req, 500);
  }

  // P-08 — La session GoTrue doit pointer sur le user qu'on a provisionné. Une
  // collision email synthétique (D-B / D-16) pourrait retourner des tokens
  // pour un autre user → mismatch silencieux. On fail explicit si désaligné.
  if (verifyData.session.user?.id !== userId) {
    await unburn();
    return json({ error: "session_user_mismatch" }, req, 500);
  }

  return json({
    success: true,
    user_id: userId,
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  }, req);
}

Deno.serve(handleRequest);
