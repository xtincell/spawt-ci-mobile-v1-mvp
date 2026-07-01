// Story 6.1 — Helper d'audit log append-only.
//
// CR Chunk B M9 — Throw au lieu de swallow l'erreur INSERT.
// Avant : INSERT échoué → console.warn + continue → action destructive procède
// sans audit (violation invariant compliance). Maintenant : throw, le caller
// décide de rollback ou continuer (typique pour ban/delete : on rollback).

import { supabaseClient } from "../utility/supabaseClient";

export type AdminAction =
  | "login"
  | "login_failed"
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
  | "seed_inventory_run"
  | "report_kept"
  | "report_removed"
  | "report_warned";

export type AdminEntityType =
  | "place"
  | "place_adn"
  | "spawt_checkin"
  | "spawter"
  | "session"
  | "seed_batch"
  | "review_reports";

export interface AuditEntry {
  action: AdminAction;
  entity_type: AdminEntityType;
  entity_id?: string;
  payload_before?: unknown;
  payload_after?: unknown;
  reason?: string;
}

export class AuditLogError extends Error {
  constructor(public readonly cause: unknown) {
    super(`Audit log insert failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "AuditLogError";
  }
}

/**
 * INSERT dans admin_audit_log. **Throw** AuditLogError si l'INSERT échoue.
 * Le caller doit décider : rollback l'action destructive, retry, ou ignorer
 * (typiquement : rollback pour ban/delete, ignore pour place_publish_toggle
 * qui est non-destructif).
 *
 * Si pas de session auth (race après expiration token), throw aussi —
 * le caller ne doit jamais croire que son action a été tracée alors qu'elle
 * ne l'est pas.
 */
export async function logAuditAction(entry: AuditEntry): Promise<void> {
  const { data, error: getUserErr } = await supabaseClient.auth.getUser();
  if (getUserErr || !data.user) {
    throw new AuditLogError(getUserErr ?? new Error("no auth session"));
  }
  const user = data.user;
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
    throw new AuditLogError(error);
  }
}

/**
 * Variante "best-effort" pour les actions non-destructives (publish toggle,
 * page metriques load) qui ne doivent PAS bloquer si l'audit échoue.
 * Log console.warn en interne. **N'utiliser que si la traçabilité est
 * secondaire.** Pour ban/delete/warning : utiliser `logAuditAction` strict.
 */
export async function logAuditActionBestEffort(entry: AuditEntry): Promise<boolean> {
  try {
    await logAuditAction(entry);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[audit] best-effort insert failed", err);
    return false;
  }
}
