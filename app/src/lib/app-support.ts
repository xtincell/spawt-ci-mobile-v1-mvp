import { Platform } from "react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { withReadTimeout } from "./data-read-error";
import { isSupabaseConfigured } from "./data-source";
import { listAnnouncements } from "./announcements";

export type CheckKey = "places" | "editorials" | "collections" | "announcements" | "sync";
export interface ContentCheck { key: CheckKey; ok: boolean; count?: number }
export interface AppDiagnostic { version: string; build: string; platform: string; checkedAt?: string; checks?: ContentCheck[] }
export function appDiagnostic(): AppDiagnostic {
  return { version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "—",
    build: Application.nativeBuildVersion ?? "—", platform: Platform.OS };
}
export async function checkAppContent(): Promise<AppDiagnostic> {
  if (!isSupabaseConfigured) throw new Error("backend_unconfigured");
  const { supabase } = await import("./supabase");
  const checks = await Promise.all((["places", "editorials", "collections", "announcements", "sync"] as const).map(async (key): Promise<ContentCheck> => {
    try {
      if (key === "announcements") return { key, ok: true, count: (await listAnnouncements()).length };
      if (key === "sync") {
        const { data, error } = await withReadTimeout("content_status", signal => supabase.rpc("public_content_status").abortSignal(signal));
        if (error || typeof data !== "string") throw new Error("content_status_failed");
        return { key, ok: true };
      }
      let query = supabase.from(key === "editorials" ? "public_editorial_reviews" : key === "collections" ? "explore_collections" : "places")
        .select("id", { count: "exact", head: true });
      if (key !== "editorials") query = query.eq("is_published", true);
      const { count, error } = await withReadTimeout(key, signal => query.abortSignal(signal));
      if (error || count === null) throw new Error("content_read_failed");
      return { key, ok: true, count };
    } catch { return { key, ok: false }; }
  }));
  return { ...appDiagnostic(), checkedAt: new Date().toISOString(), checks };
}
export type FeedbackKind = "bug" | "idea" | "content";
export interface AppFeedback { id: string; kind: FeedbackKind; message: string; status: "received" | "reviewing" | "resolved"; staff_reply: string; created_at: string }
export async function sendAppFeedback(id: string, kind: FeedbackKind, message: string, context: "app" | "data_load", diagnostics: AppDiagnostic): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("backend_unconfigured");
  const { supabase } = await import("./supabase");
  const { data, error } = await withReadTimeout("feedback_send", signal => supabase.rpc("submit_app_feedback", {
    p_id: id, p_kind: kind, p_message: message.trim(), p_context: context, p_diagnostics: diagnostics,
  }).abortSignal(signal));
  if (error || data !== id) throw new Error("feedback_not_confirmed");
  return data;
}
export async function listAppFeedback(spawterId: string): Promise<AppFeedback[]> {
  const { supabase } = await import("./supabase");
  const { data, error } = await withReadTimeout("feedback_history", signal => supabase.from("app_feedback")
    .select("id,kind,message,status,staff_reply,created_at").eq("spawter_id", spawterId).order("created_at", { ascending: false }).limit(20).abortSignal(signal));
  if (error) throw new Error("feedback_history_failed");
  return data ?? [];
}
