// Story 6.4 — Ban / warning / unban d'un spawter avec atomicité + sign-out forcé.
//
// Auth : caller doit être spawt_staff actif (role admin ou moderator).
// Operation : UPDATE spawters + auth.admin.signOut(user_id) + INSERT admin_audit_log.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type ModerationAction = "ban" | "unban" | "warning";

interface ModerationRequest {
  spawter_id: string;
  action: ModerationAction;
  reason: string;
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const callerClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  // ━━━ Auth check ━━━
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ data: null, error: { code: "UNAUTHENTICATED" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  const { data: staff } = await supabase
    .from("spawt_staff")
    .select("id, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff || (staff.role !== "admin" && staff.role !== "moderator")) {
    return new Response(
      JSON.stringify({ data: null, error: { code: "FORBIDDEN" } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = (await req.json()) as ModerationRequest;
  const { spawter_id, action, reason } = body;

  if (action !== "unban" && (!reason || reason.trim().length < 3)) {
    return new Response(
      JSON.stringify({ data: null, error: { code: "INVALID_REASON", message: "Motif requis (>= 3 chars)" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: target, error: targetErr } = await supabase
    .from("spawters")
    .select("id, is_banned, warning_count, display_name")
    .eq("id", spawter_id)
    .maybeSingle();
  if (targetErr || !target) {
    return new Response(
      JSON.stringify({ data: null, error: { code: "NOT_FOUND" } }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  let auditAction: "spawter_ban" | "spawter_unban" | "spawter_warning";
  const beforeSnapshot = { is_banned: target.is_banned, warning_count: target.warning_count };
  let afterSnapshot: Record<string, unknown> = {};

  if (action === "ban") {
    if (target.is_banned) {
      return new Response(
        JSON.stringify({ data: null, error: { code: "ALREADY_BANNED" } }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }
    auditAction = "spawter_ban";
    await supabase
      .from("spawters")
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: reason,
      })
      .eq("id", spawter_id);
    await supabase.auth.admin.signOut(spawter_id, "global");
    afterSnapshot = { is_banned: true, banned_reason: reason };
  } else if (action === "unban") {
    if (!target.is_banned) {
      return new Response(
        JSON.stringify({ data: null, error: { code: "NOT_BANNED" } }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }
    auditAction = "spawter_unban";
    await supabase
      .from("spawters")
      .update({
        is_banned: false,
        banned_at: null,
        banned_reason: null,
      })
      .eq("id", spawter_id);
    afterSnapshot = { is_banned: false };
  } else {
    auditAction = "spawter_warning";
    await supabase
      .from("spawters")
      .update({
        warning_count: target.warning_count + 1,
        last_warning_at: new Date().toISOString(),
        last_warning_reason: reason,
      })
      .eq("id", spawter_id);
    afterSnapshot = {
      warning_count: target.warning_count + 1,
      last_warning_reason: reason,
    };
  }

  await supabase.from("admin_audit_log").insert({
    spawt_staff_id: user.id,
    action: auditAction,
    entity_type: "spawter",
    entity_id: spawter_id,
    payload_before: beforeSnapshot,
    payload_after: afterSnapshot,
    reason,
  });

  return new Response(
    JSON.stringify({ data: { spawter_id, action, applied: true }, error: null }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
