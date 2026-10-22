// Push console: server-side targeting, dry-run estimates and an atomic,
// idempotent reservation before sending. `sent` means accepted by Expo,
// never proof of display on a phone. Campaigns in `sending` after a timeout
// must be reconciled by an operator; they are never automatically replayed.

// @ts-expect-error — résolu en Deno runtime (URL imports)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { safeEqual } from "../_shared/safe-equal.ts";

// @ts-expect-error — Deno global
declare const Deno: { env: { get(name: string): string | undefined }; serve: (h: (req: Request) => Promise<Response> | Response) => void };

interface PushSendPayload {
  spawter_ids?: string[];
  all_spawters?: boolean;
  dry_run?: boolean;
  request_id?: string;
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
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
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
  if (p.dry_run !== undefined && typeof p.dry_run !== "boolean") return { ok: false, detail: "dry_run invalide" };
  if (p.all_spawters !== undefined && typeof p.all_spawters !== "boolean") return { ok: false, detail: "all_spawters invalide" };
  if (p.request_id !== undefined && (typeof p.request_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.request_id))) return { ok: false, detail: "request_id invalide" };
  if (p.data && JSON.stringify(p.data).length > 2500) return { ok: false, detail: "data trop grand" };
  return { ok: true, payload: p as PushSendPayload };
}

/** Paginate every filter and token read; PostgREST caps each response. */
// deno-lint-ignore no-explicit-any
async function readPages(query: () => any): Promise<any[] | null> {
  const rows = [];
  for (let offset = 0; offset < 100_000; offset += 200) {
    const { data, error } = await query().range(offset, offset + 199);
    if (error) return null;
    rows.push(...(data ?? []));
    if (!data || data.length < 200) return rows;
  }
  return null; // Never send to a silently truncated audience.
}
// deno-lint-ignore no-explicit-any
async function resolveTargets(admin: any, payload: PushSendPayload): Promise<string[] | null> {
  let ids: Set<string> | null = payload.spawter_ids !== undefined ? new Set(payload.spawter_ids) : null;
  const intersect = (next: string[]) => {
    const set = new Set(next);
    ids = ids === null ? set : new Set([...ids].filter(id => set.has(id)));
  };
  if (payload.stade) {
    const rows = await readPages(() => admin.from("spawter_progression").select("spawter_id").eq("stade",payload.stade).order("spawter_id"));
    if (!rows) return null;
    intersect(rows.map(r => r.spawter_id));
  }
  if (payload.gold_only) {
    const rows = await readPages(() => admin.from("active_entitlements").select("spawter_id").eq("is_active",true).in("plan",["gold_monthly","gold_annual"]).order("spawter_id"));
    if (!rows) return null;
    intersect(rows.map(r => r.spawter_id));
  }
  // Exclude banned accounts for every targeting mode, including explicit ids.
  const rows = await readPages(() => {
    let q = admin.from("spawters").select("id").eq("is_banned",false).order("id");
    if (payload.archetype) q=q.eq("quiz_archetype",payload.archetype);
    return q;
  });
  if (!rows) return null;
  intersect(rows.map(r => r.id));
  return [...(ids ?? new Set<string>())];
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
  // Sécurité D5 — comparaison à temps constant du service-role.
  const isInternal = safeEqual(bearer, serviceRole);
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
    payload.spawter_ids !== undefined || payload.all_spawters === true ||
    Boolean(payload.stade) ||
    Boolean(payload.archetype) ||
    payload.gold_only === true;
  if (!hasTarget) {
    return json({ error: "missing_targets" }, req, 400);
  }

  if (staffId && !payload.dry_run && !payload.request_id) return json({ error: "invalid_payload", detail: "request_id requis" }, req, 400);

  // ━━━ Résolution des cibles → tokens ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const targetIds = await resolveTargets(admin, payload);
  if (targetIds === null) {
    return json({ error: "targets_failed" }, req, 500);
  }
  const tokens: string[] = [];
  for (const idChunk of chunk(targetIds, DB_IN_CHUNK_SIZE)) {
    const rows = await readPages(() => admin.from("push_tokens").select("token").in("spawter_id",idChunk).order("id"));
    if (!rows) return json({ error: "targets_failed" }, req, 500);
    tokens.push(...rows.map(r => r.token).filter(Boolean));
  }
  if (payload.dry_run) return json({ targets: targetIds.length, tokens: tokens.length, dry_run: true }, req);
  if (staffId) {
    const { dry_run: _dry, request_id: _id, ...content } = payload;
    const { data, error } = await admin.rpc("reserve_push_campaign", {
      p_id: payload.request_id, p_staff_id: staffId, p_payload: content,
      p_targets: targetIds.length, p_tokens: tokens.length,
    });
    if (error) return json({ error: error.message === "campaign_limit_reached" ? "campaign_limit_reached" : "campaign_reservation_failed" }, req, error.message === "campaign_limit_reached" ? 429 : 500);
    if (!data?.reserved) {
      const previous = data?.campaign;
      if (previous?.status === "completed") return json({ sent: previous.sent, failed: previous.failed, purged: previous.purged, replayed: true }, req);
      return json({ error: "campaign_in_progress", request_id: payload.request_id }, req, 409);
    }
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

  if (staffId) {
    const { error } = await admin.from("push_campaigns").update({ status: "completed", sent, failed, purged, completed_at: new Date().toISOString() }).eq("id",payload.request_id);
    if (error) return json({ error: "campaign_result_unconfirmed", request_id: payload.request_id }, req, 500);
  }

  return json({ sent, failed, purged }, req, 200);
}

Deno.serve(handleRequest);
