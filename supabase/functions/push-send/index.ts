// Edge Function `push-send` — Feature 13 (push serveur).
// Runtime : Deno (Supabase Edge). Envoi de notifications push via l'API Expo.
//
// ━━━ CONTRAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /functions/v1/push-send
//
// Auth (2 modes) :
//   (a) interne — `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
//       (appels serveur→serveur : payment-cron, futurs crons). Pas de limite.
//   (b) staff — `Authorization: Bearer <access_token>` d'un compte dont
//       is_admin_staff() est vrai (spawt_staff role='admin' + is_active,
//       vérifié par SELECT via le client service_role — pattern
//       moderate-spawter). Limite anti-abus : max 3 campagnes / jour UTC,
//       comptées via admin_audit_log action='push_campaign'.
//
// Body JSON :
//   {
//     "spawter_ids"?: string[],   // cibles directes (prioritaire sur les filtres)
//     "stade"?: string,           // filtre spawter_progression.stade
//     "archetype"?: string,       // filtre spawters.quiz_archetype
//     "gold_only"?: boolean,      // filtre vue active_entitlements.is_active
//     "title": string,            // requis (1..178 chars)
//     "body": string,             // requis (1..2048 chars)
//     "data"?: { ... }            // payload notif — ex. deep_link, type
//   }
//   Au moins UNE cible requise (spawter_ids OU stade OU archetype OU gold_only).
//   stade + archetype + gold_only se cumulent en intersection.
//
// Appel interne type (payment-cron, renouvellement Gold) :
//   POST push-send   Authorization: Bearer <SERVICE_ROLE>
//   { "spawter_ids": ["<uuid>"], "title": "…", "body": "…",
//     "data": { "type": "gold_renewal", "deep_link": "/settings" } }
//
// Réponse 200 : { "sent": n, "failed": n, "purged": n }
//   sent   = tickets Expo status "ok"
//   failed = tickets en erreur (hors purge) + chunks en échec réseau/HTTP
//   purged = tokens DeviceNotRegistered supprimés de push_tokens
// Erreurs : 400 invalid_json | invalid_payload | missing_targets,
//           401 unauthenticated, 403 forbidden, 405 method_not_allowed,
//           429 campaign_limit_reached, 500 edge_misconfigured | targets_failed.
//
// Envoi : POST https://exp.host/--/api/v2/push/send par chunks de 100 messages
// (limite API Expo), channelId Android "spawt" (créé côté app, push-token.ts).
// DeviceNotRegistered au niveau ticket → DELETE du token. Les receipts
// asynchrones Expo (getReceipts) ne sont pas interrogés en V1 : la purge se
// fait sur les tickets immédiats + naturellement au prochain envoi.
//
// gold_only : si la vue active_entitlements est absente/en échec (migration
// 0032 pas encore appliquée), fallback SILENCIEUX — le filtre est ignoré
// (loggé), les autres critères s'appliquent.
//
// ⚠️ Limite connue : le CHECK de admin_audit_log.action (migration 0017)
// n'inclut pas encore 'push_campaign'. Tant que le chantier migrations ne l'a
// pas étendu, l'INSERT d'audit échoue (loggé, non bloquant — l'envoi est déjà
// parti) et la limite 3 campagnes/jour est de facto inopérante (count = 0).
// Fail-open assumé, cf. mission Feature 13.
//
// CORS : pattern ALLOWED_ORIGINS fail-closed (copié d'otp-send — jamais de
// reflect d'une origin non-whitelistée).
// Secrets : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// (injectés par défaut), ALLOWED_ORIGINS (CSV origins web autorisées).
//
// Déploiement :
//   supabase functions deploy push-send

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// @ts-expect-error — Deno global
declare const Deno: { env: { get(name: string): string | undefined }; serve: (h: (req: Request) => Promise<Response> | Response) => void };

interface PushSendPayload {
  spawter_ids?: string[];
  stade?: string;
  archetype?: string;
  gold_only?: boolean;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Limite API Expo : 100 messages max par requête push/send. */
export const EXPO_PUSH_CHUNK_SIZE = 100;
/** Chunk des clauses `.in()` PostgREST (longueur d'URL bornée). */
const DB_IN_CHUNK_SIZE = 200;
/** Anti-abus staff : max campagnes par jour UTC. */
const MAX_STAFF_CAMPAIGNS_PER_DAY = 3;
/** Channel Android côté app (push-token.ts — ensurePushChannel). */
const ANDROID_CHANNEL_ID = "spawt";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ── CORS fail-closed (pattern otp-send P-11/P-09) ───────────────────────────

function readAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return [];
  return raw.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = readAllowedOrigins();
  const origin = req.headers.get("origin");
  // Une origin inconnue (ou absente) n'est JAMAIS reflétée — "null" sinon.
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

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Découpe `items` en chunks de taille `size` — exporté pour les tests. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);
}

/** Validation manuelle du body (pattern otp-send — pas de dépendance zod). */
function validatePayload(raw: unknown): { ok: true; payload: PushSendPayload } | { ok: false; detail: string } {
  const p = raw as Partial<PushSendPayload> | null;
  if (!p || typeof p !== "object") return { ok: false, detail: "body must be an object" };
  if (typeof p.title !== "string" || p.title.trim().length === 0 || p.title.length > 178) {
    return { ok: false, detail: "title requis (1..178 chars)" };
  }
  if (typeof p.body !== "string" || p.body.trim().length === 0 || p.body.length > 2048) {
    return { ok: false, detail: "body requis (1..2048 chars)" };
  }
  if (p.spawter_ids !== undefined && !isStringArray(p.spawter_ids)) {
    return { ok: false, detail: "spawter_ids doit être string[]" };
  }
  if (p.spawter_ids !== undefined && p.spawter_ids.length > 10_000) {
    return { ok: false, detail: "spawter_ids trop grand (max 10000)" };
  }
  if (p.stade !== undefined && typeof p.stade !== "string") {
    return { ok: false, detail: "stade doit être string" };
  }
  if (p.archetype !== undefined && typeof p.archetype !== "string") {
    return { ok: false, detail: "archetype doit être string" };
  }
  if (p.gold_only !== undefined && typeof p.gold_only !== "boolean") {
    return { ok: false, detail: "gold_only doit être boolean" };
  }
  if (p.data !== undefined && (typeof p.data !== "object" || p.data === null || Array.isArray(p.data))) {
    return { ok: false, detail: "data doit être un objet" };
  }
  return { ok: true, payload: p as PushSendPayload };
}

/**
 * Résout les spawter_ids ciblés. spawter_ids directs prioritaires ; sinon
 * intersection des filtres stade / archetype / gold_only.
 * Retourne null si une query indispensable échoue (stade/archetype) —
 * gold_only seul est fail-open (fallback silencieux si vue absente).
 */
async function resolveTargets(
  // deno-lint-ignore no-explicit-any
  admin: any,
  payload: PushSendPayload,
): Promise<string[] | null> {
  if (payload.spawter_ids && payload.spawter_ids.length > 0) {
    return [...new Set(payload.spawter_ids)];
  }

  let ids: Set<string> | null = null;
  const intersect = (next: string[]) => {
    const nextSet = new Set(next);
    ids = ids === null ? nextSet : new Set([...ids].filter((id) => nextSet.has(id)));
  };

  if (payload.stade) {
    const { data, error } = await admin
      .from("spawter_progression")
      .select("spawter_id")
      .eq("stade", payload.stade);
    if (error) {
      console.error("[push-send] filtre stade failed", error.message);
      return null;
    }
    intersect((data ?? []).map((r: { spawter_id: string }) => r.spawter_id));
  }

  if (payload.archetype) {
    const { data, error } = await admin
      .from("spawters")
      .select("id")
      .eq("quiz_archetype", payload.archetype);
    if (error) {
      console.error("[push-send] filtre archetype failed", error.message);
      return null;
    }
    intersect((data ?? []).map((r: { id: string }) => r.id));
  }

  if (payload.gold_only) {
    const { data, error } = await admin
      .from("active_entitlements")
      .select("spawter_id")
      .eq("is_active", true);
    if (error) {
      // Vue absente (migration 0032 pas appliquée) — fallback SILENCIEUX :
      // le filtre gold est ignoré, les autres critères restent appliqués.
      console.warn("[push-send] vue active_entitlements indisponible — filtre gold ignoré", error.message);
    } else {
      intersect((data ?? []).map((r: { spawter_id: string }) => r.spawter_id));
    }
  }

  return ids === null ? [] : [...(ids as Set<string>)];
}

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST, OPTIONS", ...corsHeaders(req) },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRole || !anonKey) {
    return json({ error: "edge_misconfigured" }, req, 500);
  }

  // ━━━ Auth : (a) service_role interne OU (b) staff admin ━━━━━━━━━━━━━━━━━━
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json({ error: "unauthenticated" }, req, 401);

  const admin = createClient(supabaseUrl, serviceRole);
  const isInternal = bearer === serviceRole;
  let staffId: string | null = null;

  if (!isInternal) {
    // Pattern moderate-spawter : getUser via client anon + Authorization du
    // caller, puis SELECT spawt_staff via le client service_role.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    const caller = userData?.user;
    if (userError || !caller) return json({ error: "unauthenticated" }, req, 401);

    // Équivalent SELECT de is_admin_staff() (helper 0021) : role admin actif.
    const { data: staff } = await admin
      .from("spawt_staff")
      .select("id, role, is_active")
      .eq("id", caller.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!staff || staff.role !== "admin") {
      return json({ error: "forbidden" }, req, 403);
    }
    staffId = caller.id;
  }

  // ━━━ Payload ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "invalid_json" }, req, 400);
  }
  const validated = validatePayload(raw);
  if (!validated.ok) {
    return json({ error: "invalid_payload", detail: validated.detail }, req, 400);
  }
  const payload = validated.payload;

  const hasTarget =
    (payload.spawter_ids && payload.spawter_ids.length > 0) ||
    Boolean(payload.stade) ||
    Boolean(payload.archetype) ||
    payload.gold_only === true;
  if (!hasTarget) {
    return json({ error: "missing_targets" }, req, 400);
  }

  // ━━━ Anti-abus staff : max 3 campagnes / jour UTC ━━━━━━━━━━━━━━━━━━━━━━━━
  // Comptage via admin_audit_log action='push_campaign'. Fail-open : si le
  // comptage échoue (CHECK 0017 pas encore étendu → aucune row ; table en
  // erreur), on log et on continue — cf. limite connue en tête de fichier.
  if (staffId) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count, error: countError } = await admin
      .from("admin_audit_log")
      .select("*", { count: "exact", head: true })
      .eq("action", "push_campaign")
      .gte("created_at", dayStart.toISOString());
    if (countError) {
      console.warn("[push-send] comptage campagnes failed — limite non appliquée", countError.message);
    } else if ((count ?? 0) >= MAX_STAFF_CAMPAIGNS_PER_DAY) {
      return json({ error: "campaign_limit_reached", limit: MAX_STAFF_CAMPAIGNS_PER_DAY }, req, 429);
    }
  }

  // ━━━ Résolution des cibles → tokens ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const targetIds = await resolveTargets(admin, payload);
  if (targetIds === null) {
    return json({ error: "targets_failed" }, req, 500);
  }
  if (targetIds.length === 0) {
    return json({ sent: 0, failed: 0, purged: 0 }, req, 200);
  }

  const tokens: string[] = [];
  for (const idChunk of chunk(targetIds, DB_IN_CHUNK_SIZE)) {
    const { data, error } = await admin
      .from("push_tokens")
      .select("token")
      .in("spawter_id", idChunk);
    if (error) {
      console.error("[push-send] lecture push_tokens failed", error.message);
      return json({ error: "targets_failed" }, req, 500);
    }
    for (const row of (data ?? []) as { token: string }[]) {
      if (row.token) tokens.push(row.token);
    }
  }
  if (tokens.length === 0) {
    return json({ sent: 0, failed: 0, purged: 0 }, req, 200);
  }

  // ━━━ Envoi Expo par chunks de 100 + purge DeviceNotRegistered ━━━━━━━━━━━━
  let sent = 0;
  let failed = 0;
  let purged = 0;
  const toPurge: string[] = [];

  for (const tokenChunk of chunk(tokens, EXPO_PUSH_CHUNK_SIZE)) {
    const messages = tokenChunk.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      sound: "default",
      channelId: ANDROID_CHANNEL_ID,
      ...(payload.data ? { data: payload.data } : {}),
    }));
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) {
        console.error("[push-send] expo push HTTP", resp.status);
        failed += tokenChunk.length;
        continue;
      }
      const body = (await resp.json()) as { data?: ExpoTicket[] };
      const tickets = Array.isArray(body.data) ? body.data : [];
      for (let i = 0; i < tokenChunk.length; i++) {
        const ticket = tickets[i];
        if (ticket?.status === "ok") {
          sent++;
        } else if (ticket?.details?.error === "DeviceNotRegistered") {
          // Token mort (app désinstallée, token invalidé) → purge de la row.
          toPurge.push(tokenChunk[i]);
        } else {
          failed++;
        }
      }
    } catch (err) {
      console.error("[push-send] expo push fetch failed", err);
      failed += tokenChunk.length;
    }
  }

  for (const purgeChunk of chunk(toPurge, DB_IN_CHUNK_SIZE)) {
    const { error } = await admin.from("push_tokens").delete().in("token", purgeChunk);
    if (error) {
      // Purge impossible — les tickets restent comptés en failed (honnête).
      console.error("[push-send] purge push_tokens failed", error.message);
      failed += purgeChunk.length;
    } else {
      purged += purgeChunk.length;
    }
  }

  // ━━━ Audit (staff uniquement) — fail-open, l'envoi est déjà parti ━━━━━━━━
  if (staffId) {
    const { error: auditError } = await admin.from("admin_audit_log").insert({
      spawt_staff_id: staffId,
      action: "push_campaign",
      entity_type: "session",
      entity_id: null,
      payload_after: {
        title: payload.title,
        targets: targetIds.length,
        tokens: tokens.length,
        sent,
        failed,
        purged,
      },
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });
    if (auditError) {
      // CHECK 0017 pas encore étendu à 'push_campaign' → échec attendu tant
      // que le chantier migrations n'a pas livré. Loggé, non bloquant.
      console.error("[push-send] audit push_campaign failed (envoi effectué)", auditError.message);
    }
  }

  return json({ sent, failed, purged }, req, 200);
}

Deno.serve(handleRequest);
