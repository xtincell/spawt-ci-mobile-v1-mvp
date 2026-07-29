// Aligne sur les conventions Supabase JS V2.
// IMPORTANT : ne jamais inliner SUPABASE_SERVICE_ROLE_KEY côté client.
// Toute opération privilégiée passe par une Edge Function.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Configuration absente = console inutilisable, mais **pas** écran blanc.
 *
 * Ce module faisait un `throw` au chargement. Un throw à l'évaluation d'un
 * module casse tout l'arbre d'imports AVANT que React ne monte quoi que ce
 * soit : l'`ErrorBoundary` de l'application n'existe pas encore, et
 * l'exploitant ne voit qu'une page blanche, sans le moindre indice — le pire
 * mode de défaillance possible pour un outil interne.
 *
 * On dégrade donc proprement : la configuration manquante est signalée par
 * `supabaseConfigError`, que `App.tsx` affiche en clair, et le client est créé
 * sur une URL sentinelle qui échouera à la première requête plutôt qu'au
 * chargement. Même doctrine que le portail.
 */
export const supabaseConfigError: string | null =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? "Configuration manquante : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être posées AU MOMENT DU BUILD (Vite les fige dans le bundle — un simple redéploiement ne suffit pas). Voir spawt-admin/.env.example."
    : null;

export const supabaseClient = createClient(
  SUPABASE_URL ?? "https://configuration-manquante.invalid",
  SUPABASE_ANON_KEY ?? "cle-anon-manquante",
  {
    auth: {
      persistSession: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      flowType: "pkce",
    },
  },
);
