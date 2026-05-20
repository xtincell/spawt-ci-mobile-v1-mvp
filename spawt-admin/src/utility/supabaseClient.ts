// Aligne sur les conventions Supabase JS V2.
// IMPORTANT : ne jamais inliner SUPABASE_SERVICE_ROLE_KEY côté client.
// Toute opération privilégiée passe par une Edge Function Supabase.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[spawt-admin] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
      "Voir spawt-admin/.env.example.",
  );
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    flowType: "pkce",
  },
});
