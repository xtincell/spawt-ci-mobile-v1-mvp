// Story 6.1 — Helper d'audit log append-only.
// L'INSERT échoué n'est pas re-thrown — le pipeline UX continue, le drift est loggé.

import { supabaseClient } from "../utility/supabaseClient";

export type AdminAction =
  | "login"
  | "place_create"
  | "place_update"
  | "place_delete"
  | "place_publish_toggle"
  | "place_adn_update"
  | "review_keep"
  | "review_delete"
  | "review_warning"
  | "spawter_warning"
  | "spawter_ban"
  | "spawter_unban"
  | "seed_inventory_run";

export type AdminEntityType =
  | "place"
  | "place_adn"
  | "spawt_checkin"
  | "spawter"
  | "session"
  | "seed_batch";

export interface AuditEntry {
  action: AdminAction;
  entity_type: AdminEntityType;
  entity_id?: string;
  payload_before?: unknown;
  payload_after?: unknown;
  reason?: string;
}

export async function logAuditAction(entry: AuditEntry): Promise<void> {
  const { data } = await supabaseClient.auth.getUser();
  const user = data.user;
  if (!user) return;
  const { error } = await supabaseClient.from("admin_audit_log").insert({
    spawt_staff_id: user.id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    payload_before: entry.payload_before ?? null,
    payload_after: entry.payload_after ?? null,
    reason: entry.reason ?? null,
    user_agent:
      typeof navigator !== "undefined"
        ? navigator.userAgent.slice(0, 500)
        : null,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[audit] insert failed", error);
  }
}
