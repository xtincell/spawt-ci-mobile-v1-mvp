// Supabase client — PRD §12.1 (stack)
// Tables et RLS configurées via migrations versionnées (Phase 0).
// Les FK pointent vers `spawters(id)` (amendement team 4.1).

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Résolution unique et traçable (voir `backend-identity.ts`). Cette expression
// était recopiée ici et dans trois autres fichiers : quatre copies qui pouvaient
// diverger sans que rien ne le signale, et aucune observable depuis l'app.
import { backendAnonKey, backendUrl } from "./backend-identity";

const RAW_URL = backendUrl.valeur;
const RAW_KEY = backendAnonKey.valeur;

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
    // ⚠️ SANS cet adaptateur, `persistSession: true` est un piège sur mobile.
    //
    // supabase-js se rabat sur `localStorage` quand aucun `storage` n'est
    // fourni. `localStorage` n'existe pas en React Native : ouvrir la session
    // échoue APRÈS que le serveur l'a pourtant émise. L'utilisateur voit un
    // échec, la base montre une connexion réussie — et les deux ont raison.
    //
    // Le pire est que ça marche partout où l'on teste : la recette navigateur
    // tourne sur `react-native-web`, où `localStorage` existe. Ce défaut était
    // donc invisible par construction à tout test hors appareil réel — seul un
    // APK installé pouvait le révéler.
    //
    // Conséquence seconde, même sans erreur visible : aucune session ne
    // survivrait au redémarrage de l'app.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
