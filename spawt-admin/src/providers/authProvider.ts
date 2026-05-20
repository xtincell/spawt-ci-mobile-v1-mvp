// Story 6.1 — authProvider Refine custom branché sur spawt_staff.
// Défense en profondeur : la RLS `spawt_staff_select_own` (migration 0001) bloque
// déjà la lecture à un non-staff — la double vérification (`.maybeSingle()` + signout)
// est défense en profondeur côté UX (message clair plutôt que page vide).

import type { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "../utility/supabaseClient";
import { logAuditAction } from "../lib/audit";

interface StaffRow {
  id: string;
  role: "admin" | "moderator" | "operator";
  is_active: boolean;
  display_name: string;
  email: string;
}

interface LoginParams {
  email: string;
  password: string;
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }: LoginParams) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      return {
        success: false,
        error: {
          name: "AuthError",
          message: error?.message ?? "Identifiants invalides",
        },
      };
    }

    const { data: staff } = await supabaseClient
      .from("spawt_staff")
      .select("id, role, is_active, display_name, email")
      .eq("id", data.session.user.id)
      .eq("is_active", true)
      .maybeSingle<StaffRow>();

    if (!staff) {
      await supabaseClient.auth.signOut();
      return {
        success: false,
        error: {
          name: "AuthRejection",
          message: "Compte non autorisé pour le panel admin SPAWT.",
        },
      };
    }

    await logAuditAction({ action: "login", entity_type: "session" });

    return { success: true, redirectTo: "/lieux" };
  },

  logout: async () => {
    await supabaseClient.auth.signOut();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
      return { authenticated: false, redirectTo: "/login" };
    }
    const { data: staff } = await supabaseClient
      .from("spawt_staff")
      .select("id, is_active")
      .eq("id", data.session.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!staff) {
      await supabaseClient.auth.signOut();
      return { authenticated: false, redirectTo: "/login" };
    }
    return { authenticated: true };
  },

  getPermissions: async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) return null;
    const { data: staff } = await supabaseClient
      .from("spawt_staff")
      .select("role")
      .eq("id", data.session.user.id)
      .maybeSingle<{ role: StaffRow["role"] }>();
    return staff?.role ?? null;
  },

  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) return null;
    const { data: staff } = await supabaseClient
      .from("spawt_staff")
      .select("id, email, display_name, role")
      .eq("id", data.session.user.id)
      .maybeSingle<StaffRow>();
    if (!staff) return null;
    return {
      id: staff.id,
      email: staff.email,
      display_name: staff.display_name,
      role: staff.role,
    };
  },

  onError: async (error: unknown) => ({ error: error as Error }),
};
