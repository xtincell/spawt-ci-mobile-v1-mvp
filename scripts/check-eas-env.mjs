#!/usr/bin/env node
// =============================================================================
// SPAWT — garde-fou : un binaire distribuable ne part jamais sans backend
// =============================================================================
// `app/eas.json` n'a longtemps contenu AUCUN bloc `env`. Comme l'adaptateur de
// données se rabattait silencieusement sur les fixtures quand l'URL manquait,
// tous les APK produits ont servi du faux contenu — et l'app est passée pour
// « non fonctionnelle » alors que seule la configuration de build manquait.
//
// Ce script rend cette panne impossible à réexpédier : il échoue si un profil
// destiné à être installé par quelqu'un (preview, production…) n'a ni backend
// ni opt-in démo explicite. Appelé par le workflow EAS avant le build.
//
// Usage : node scripts/check-eas-env.mjs [profil]
//         (sans argument : vérifie tous les profils distribuables)
// =============================================================================

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EAS_JSON = join(HERE, "..", "app", "eas.json");

/** `development` est exclu : il tourne sur un poste de dev, jamais distribué. */
const PROFILS_DISTRIBUABLES = ["preview", "production", "preview-ios-device"];

const eas = JSON.parse(await readFile(EAS_JSON, "utf8"));
const demande = process.argv[2];
const aVerifier = demande ? [demande] : PROFILS_DISTRIBUABLES;

let echecs = 0;
for (const nom of aVerifier) {
  const profil = eas.build?.[nom];
  if (!profil) {
    if (demande) {
      console.error(`[eas-env] profil inconnu : ${nom}`);
      process.exit(1);
    }
    continue;
  }
  if (!PROFILS_DISTRIBUABLES.includes(nom)) {
    console.log(`[eas-env] ${nom.padEnd(20)} ignoré (non distribuable)`);
    continue;
  }

  const env = profil.env ?? {};
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const demo = env.EXPO_PUBLIC_DEMO_MODE === "true";

  if (demo) {
    console.log(`[eas-env] ${nom.padEnd(20)} mode démo ASSUMÉ (opt-in explicite)`);
    continue;
  }
  if (!url || !key) {
    console.error(
      `[eas-env] ${nom.padEnd(20)} ÉCHEC — ni backend ni opt-in démo.\n` +
        `           Ce build produirait un binaire qui affiche « Configuration manquante ».\n` +
        `           Poser EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY dans\n` +
        `           app/eas.json (profil ${nom}), ou EXPO_PUBLIC_DEMO_MODE=true si c'est voulu.`,
    );
    echecs += 1;
    continue;
  }
  if (!/^https:\/\//.test(url)) {
    // Android bloque le trafic en clair par défaut : une URL http produirait
    // une app qui ne charge rien, sans message d'erreur explicite.
    console.error(`[eas-env] ${nom.padEnd(20)} ÉCHEC — l'URL doit être en https (reçu : ${url})`);
    echecs += 1;
    continue;
  }
  console.log(`[eas-env] ${nom.padEnd(20)} ok — ${url}`);
}

if (echecs > 0) process.exit(1);
console.log("[eas-env] tous les profils distribuables sont branchés.");
