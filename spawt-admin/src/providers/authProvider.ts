// Identité staff fournie par la RPC current_staff() (0062).
// Elle ne renvoie que le compte actif de la session, quel que soit son rôle.

import type { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "../utility/supabaseClient";
import { logAuditAction } from "../lib/audit";

interface StaffRow {
  id: string;
  role: "admin" | "moderator" | "operator";
  display_name: string;
}

interface LoginParams {
  email: string;
  password: string;
}

function currentStaff() {
  return supabaseClient.rpc("current_staff").maybeSingle<StaffRow>();
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

    const { data: staff, error: staffError } = await currentStaff();
    if (staffError) {
      await supabaseClient.auth.signOut();
      return {
        success: false,
        error: { name: "StaffLookupError", message: `Vérification de l'accès impossible : ${staffError.message}` },
      };
    }

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

    try {
      await logAuditAction({ action: "login", entity_type: "session" });
    } catch {
      await supabaseClient.auth.signOut();
      return {
        success: false,
        error: { name: "AuditError", message: "La connexion n'a pas pu être journalisée. Réessaie dans un instant." },
      };
    }

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
    const { data: staff, error: staffError } = await currentStaff();
    if (staffError) {
      // Une panne réseau ne révoque pas la session. L'accès reste fermé et
      // pourra être vérifié de nouveau sans supprimer le jeton local.
      return { authenticated: false, redirectTo: "/login", error: staffError };
    }
    if (!staff) {
      await supabaseClient.auth.signOut();
      return { authenticated: false, redirectTo: "/login" };
    }
    return { authenticated: true };
  },

  getPermissions: async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) return null;
    const { data: staff } = await currentStaff();
    return staff?.role ?? null;
  },

  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) return null;
    const { data: staff } = await currentStaff();
    if (!staff) return null;
    return {
      id: staff.id,
      email: data.session.user.email,
      display_name: staff.display_name,
      role: staff.role,
    };
  },

  onError: async (error: unknown) => ({ error: error as Error }),
};
