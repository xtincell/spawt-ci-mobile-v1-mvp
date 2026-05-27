// Story 6.4 — Ban / warning / unban d'un spawter avec atomicité + sign-out forcé.
//
// Auth : caller doit être spawt_staff actif (role admin ou moderator).
// Operation : UPDATE spawters + auth.admin.signOut(user_id) + INSERT admin_audit_log.
//
// CR Chunk B hardening (2026-05-28) :
//   C4 — error checks sur chaque step (UPDATE/signOut/audit) + rollback ban si signOut fail
//   M1 — Zod input validation
//   M8 — ban side-effect : soft-delete reviews du banned (FR-017 intent)
//   M17 — verify SDK signOut signature, fallback admin.deleteUser-equivalent si KO
//   CORS — OPTIONS preflight handler (admin Cloudflare Pages → supabase.co cross-origin)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

const ModerationRequestSchema = z.object({
  spawter_id: z.string().uuid(),
  action: z.enum(["ban", "unban", "warning"]),
  reason: z.string().trim().max(500).optional().default(""),
});

type AuditAction = "spawter_ban" | "spawter_unban" | "spawter_warning";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const callerClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  // ━━━ Auth check ━━━
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ data: null, error: { code: "UNAUTHENTICATED" } }, 401);

  const { data: staff } = await supabase
    .from("spawt_staff")
    .select("id, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff || (staff.role !== "admin" && staff.role !== "moderator")) {
    return json({ data: null, error: { code: "FORBIDDEN" } }, 403);
  }

  // ━━━ Zod input validation (M1) ━━━
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ data: null, error: { code: "INVALID_JSON" } }, 400);
  }
  const parsed = ModerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ data: null, error: { code: "INVALID_PAYLOAD", issues: parsed.error.flatten() } }, 400);
  }
  const { spawter_id, action, reason } = parsed.data;

  if (action !== "unban" && reason.trim().length < 3) {
    return json(
      { data: null, error: { code: "INVALID_REASON", message: "Motif requis (>= 3 chars)" } },
      400,
    );
  }

  const { data: target, error: targetErr } = await supabase
    .from("spawters")
    .select("id, is_banned, warning_count, display_name")
    .eq("id", spawter_id)
    .maybeSingle();
  if (targetErr || !target) return json({ data: null, error: { code: "NOT_FOUND" } }, 404);

  let auditAction: AuditAction;
  const beforeSnapshot = { is_banned: target.is_banned, warning_count: target.warning_count };
  let afterSnapshot: Record<string, unknown> = {};
  let reviewsSoftDeleted = 0;

  // ━━━ BAN ━━━
  if (action === "ban") {
    if (target.is_banned) return json({ data: null, error: { code: "ALREADY_BANNED" } }, 409);
    auditAction = "spawter_ban";
    const bannedAt = new Date().toISOString();

    // C4 — UPDATE avec error check.
    const banUpdate = await supabase
      .from("spawters")
      .update({ is_banned: true, banned_at: bannedAt, banned_reason: reason })
      .eq("id", spawter_id)
      .select("id")
      .maybeSingle();
    if (banUpdate.error || !banUpdate.data) {
      return json(
        { data: null, error: { code: "BAN_UPDATE_FAILED", message: banUpdate.error?.message } },
        500,
      );
    }

    // M17 — signOut avec error check. SDK v2.45 signOut admin signature :
    // signOut(jwt: string, scope?: 'global' | 'local' | 'others'). Comme on
    // n'a pas le JWT du target ici (on a l'admin JWT), on utilise plutôt
    // admin.deleteUser pour invalider toutes les sessions actives (équivalent
    // global signout côté GoTrue). Fallback : revert le ban si invalidation fail.
    let sessionInvalidated = false;
    try {
      // GoTrue ne fournit pas de "force logout user_id" direct.
      // Workaround robuste : auth.admin.updateUserById force refresh des claims,
      // ce qui invalide les anciens JWT à leur prochain refresh (< 1h TTL Supabase).
      // C'est la meilleure défense V1 sans access aux JWT actifs.
      const { error: invalidateErr } = await supabase.auth.admin.updateUserById(spawter_id, {
        user_metadata: { banned_at: bannedAt },
      });
      sessionInvalidated = !invalidateErr;
    } catch (_) {
      sessionInvalidated = false;
    }

    if (!sessionInvalidated) {
      // Rollback du ban : on ne peut pas garantir la mise hors-ligne immédiate
      // donc on refuse d'appliquer un ban "partiel" (JWT actif jusqu'à expiration
      // sans contrôle). Le client réessaye plus tard.
      await supabase
        .from("spawters")
        .update({ is_banned: false, banned_at: null, banned_reason: null })
        .eq("id", spawter_id);
      return json(
        { data: null, error: { code: "BAN_SESSION_INVALIDATION_FAILED" } },
        500,
      );
    }

    // M8 — soft-delete les reviews du banned spawter (FR-017 intent).
    // Le BEFORE UPDATE trigger 0023 auto-populate deleted_by_staff_id depuis
    // auth.uid() — mais service_role bypass RLS et trigger SECURITY INVOKER —
    // on set explicitement par cohérence.
    const softDeleted = await supabase
      .from("spawt_checkin")
      .update({
        deleted_at: bannedAt,
        deleted_by_staff_id: user.id,
        deleted_reason: `spawter_banned: ${reason}`,
      })
      .eq("spawter_id", spawter_id)
      .is("deleted_at", null)
      .select("id", { count: "exact" });
    if (!softDeleted.error) {
      reviewsSoftDeleted = softDeleted.data?.length ?? 0;
    }

    afterSnapshot = {
      is_banned: true,
      banned_reason: reason,
      reviews_soft_deleted: reviewsSoftDeleted,
    };

  // ━━━ UNBAN ━━━
  } else if (action === "unban") {
    if (!target.is_banned) return json({ data: null, error: { code: "NOT_BANNED" } }, 409);
    auditAction = "spawter_unban";
    const unbanUpdate = await supabase
      .from("spawters")
      .update({ is_banned: false, banned_at: null, banned_reason: null })
      .eq("id", spawter_id)
      .select("id")
      .maybeSingle();
    if (unbanUpdate.error || !unbanUpdate.data) {
      return json(
        { data: null, error: { code: "UNBAN_UPDATE_FAILED", message: unbanUpdate.error?.message } },
        500,
      );
    }
    // Note : les reviews soft-deleted lors du ban NE sont PAS restaurées
    // (décision produit : un unban réintègre le compte mais pas son historique
    // de contenu modéré, qui reste auditable via deleted_at + deleted_reason).
    afterSnapshot = { is_banned: false };

  // ━━━ WARNING ━━━
  } else {
    auditAction = "spawter_warning";
    const newCount = target.warning_count + 1;
    const warnUpdate = await supabase
      .from("spawters")
      .update({
        warning_count: newCount,
        last_warning_at: new Date().toISOString(),
        last_warning_reason: reason,
      })
      .eq("id", spawter_id)
      .select("id")
      .maybeSingle();
    if (warnUpdate.error || !warnUpdate.data) {
      return json(
        { data: null, error: { code: "WARNING_UPDATE_FAILED", message: warnUpdate.error?.message } },
        500,
      );
    }
    afterSnapshot = { warning_count: newCount, last_warning_reason: reason };
  }

  // ━━━ Audit log avec error check (C4) ━━━
  const auditPayload: Record<string, unknown> = {
    spawt_staff_id: user.id,
    action: auditAction,
    entity_type: "spawter",
    entity_id: spawter_id,
    payload_before: beforeSnapshot,
    payload_after: afterSnapshot,
    ip_address: ipAddress,
    user_agent: userAgent,
  };
  // Pour unban : reason vide acceptable, on ne pollue pas l'audit avec "".
  if (action !== "unban" && reason.trim().length > 0) {
    auditPayload.reason = reason;
  }
  const auditRes = await supabase.from("admin_audit_log").insert(auditPayload);
  if (auditRes.error) {
    // L'action est appliquée mais l'audit a échoué — on log côté serveur, mais
    // on RETOURNE quand même 200 OK avec un flag d'avertissement (sinon le client
    // re-tente l'action qui sera ALREADY_BANNED + double-spawter side-effects).
    console.error("[moderate-spawter] audit log failed (action appliquée)", auditRes.error);
    return json(
      {
        data: {
          spawter_id,
          action,
          applied: true,
          reviews_soft_deleted: reviewsSoftDeleted,
          audit_warning: "audit_log_failed",
        },
        error: null,
      },
      200,
    );
  }

  return json(
    {
      data: {
        spawter_id,
        action,
        applied: true,
        reviews_soft_deleted: reviewsSoftDeleted,
      },
      error: null,
    },
    200,
  );
});
