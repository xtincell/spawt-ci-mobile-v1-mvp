// Story 6.4 — Client helper qui invoque l'Edge Function `moderate-spawter`.
// Le serveur fait : UPDATE spawters + auth.admin.signOut(global) + INSERT admin_audit_log.

import { supabaseClient } from "../utility/supabaseClient";

export type ModerationAction = "ban" | "unban" | "warning";

export interface ModerationResult {
  ok: boolean;
  error?: { code: string; message?: string };
}

export async function moderateSpawter(
  spawter_id: string,
  action: ModerationAction,
  reason: string,
): Promise<ModerationResult> {
  const { data, error } = await supabaseClient.functions.invoke("moderate-spawter", {
    body: { spawter_id, action, reason },
  });
  if (error) return { ok: false, error: { code: "INVOKE_FAILED", message: error.message } };
  const payload = data as { data?: unknown; error?: { code: string; message?: string } } | null;
  if (payload?.error) return { ok: false, error: payload.error };
  return { ok: true };
}
