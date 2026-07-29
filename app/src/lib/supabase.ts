// Supabase client — PRD §12.1 (stack)
// Tables et RLS configurées via migrations versionnées (Phase 0).
// Les FK pointent vers `spawters(id)` (amendement team 4.1).

import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const RAW_URL =
  Constants.expoConfig?.extra?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "";

const RAW_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "";

// @supabase/supabase-js v2.45+ throw si URL/key vides — mais en mode démo
// fallback, le client n'est jamais réellement appelé (toutes les call-sites
// gate sur `isSupabaseConfigured`). On passe donc des placeholders neutres
// pour permettre l'instanciation, et on garde le warn de configuration manquante.
const PLACEHOLDER_URL = "https://demo.invalid.supabase.co";
const PLACEHOLDER_KEY = "demo-anon-key-placeholder";

const SUPABASE_URL = RAW_URL || PLACEHOLDER_URL;
const SUPABASE_ANON_KEY = RAW_KEY || PLACEHOLDER_KEY;

if (!RAW_URL || !RAW_KEY) {
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY absents — mode démo fallback (client neutralisé via isSupabaseConfigured gate).",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
