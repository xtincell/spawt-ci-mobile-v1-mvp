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

/** Empreinte lisible — la clé anonyme est publique, on ne la recopie pas pour autant. */
function empreinte(k) {
  return k.length > 14 ? `${k.slice(0, 8)}…${k.slice(-6)} (${k.length})` : `${k} (${k.length})`;
}

/**
 * La clé est-elle celle que la PASSERELLE connaît ?
 *
 * Vérifier la présence ne suffit pas, et l'avoir cru a coûté cher.
 *
 * `/functions/v1/*` n'a aucun plugin `key-auth` côté Kong : les Edge Functions
 * gèrent leur propre autorisation. Mesuré sur le serveur réel, `otp-send`
 * répond 200 avec une clé bidon ET avec la chaîne « demo-anon-key-placeholder ».
 * Autrement dit, tout le tunnel de connexion visible — saisie du numéro, envoi
 * du code, vérification du code — fonctionne parfaitement dans un binaire dont
 * la clé est fausse.
 *
 * `/auth/v1/*` et `/rest/v1/*`, eux, sont derrière `key-auth`. Une clé inconnue
 * y produit exactement, et seulement, `401 {"message":"Unauthorized"}`. Le
 * binaire passe donc l'OTP, puis meurt à l'ouverture de session — et toutes les
 * lectures de données meurent avec, sans que rien ne nomme la cause.
 *
 * On appelle donc `/auth/v1/user` SANS jeton porteur. Trois réponses possibles,
 * et les trois sont sans ambiguïté :
 *   * 401 `no_authorization` (forme GoTrue) → la passerelle a ACCEPTÉ la clé et
 *     a transmis ; il manque juste le jeton, ce qui est attendu ici. ✔
 *   * 401 `{"message":…}` (forme Kong, avec `request_id`) → clé absente ou
 *     inconnue. ✘
 *   * réseau injoignable → on ne sait pas, et on le dit.
 */
async function interrogerPasserelle(url, key) {
  const cible = `${url.replace(/\/+$/, "")}/auth/v1/user`;
  let reponse;
  try {
    const minuterie = AbortSignal.timeout(15_000);
    reponse = await fetch(cible, { headers: { apikey: key }, signal: minuterie });
  } catch (e) {
    return { etat: "injoignable", detail: `${cible} : ${e?.message ?? e}` };
  }
  const corps = await reponse.text();
  let parsed = {};
  try {
    parsed = JSON.parse(corps);
  } catch {
    // corps non-JSON : on le traitera comme une réponse inattendue ci-dessous.
  }
  // La forme du corps est plus fiable que le statut : GoTrue et Kong répondent
  // tous deux 401, mais avec des champs différents.
  if (typeof parsed.error_code === "string" || typeof parsed.msg === "string") {
    return { etat: "acceptee", detail: parsed.error_code ?? "réponse GoTrue" };
  }
  if (typeof parsed.message === "string") {
    return { etat: "refusee", detail: `la passerelle répond « ${parsed.message} »` };
  }
  return {
    etat: "injoignable",
    detail: `réponse inattendue (${reponse.status}) : ${corps.slice(0, 80)}`,
  };
}

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

  const verdict = await interrogerPasserelle(url, key);
  if (verdict.etat === "refusee") {
    console.error(
      `[eas-env] ${nom.padEnd(20)} ÉCHEC — la passerelle REFUSE cette clé (${verdict.detail}).\n` +
        `           Empreinte envoyée : ${empreinte(key)}\n` +
        `           Ce build produirait un APK où l'envoi du code marche (les Edge\n` +
        `           Functions ne vérifient aucune clé) mais où l'ouverture de session\n` +
        `           et TOUTES les lectures de données échouent en « Unauthorized ».\n` +
        `           Corriger EXPO_PUBLIC_SUPABASE_ANON_KEY dans app/eas.json (profil ${nom}).`,
    );
    echecs += 1;
    continue;
  }
  if (verdict.etat === "injoignable") {
    // Ne pas confondre « clé fausse » et « je n'ai pas pu vérifier ». Bloquer un
    // build parce que le réseau du runner hoquette rendrait le garde-fou
    // détestable, donc désactivé — et un garde-fou désactivé ne garde rien.
    console.warn(
      `[eas-env] ${nom.padEnd(20)} ⚠ clé NON vérifiée — ${verdict.detail}\n` +
        `           (le contrôle réseau est passé, pas réussi)`,
    );
    continue;
  }
  console.log(`[eas-env] ${nom.padEnd(20)} ok — ${url} — clé acceptée par la passerelle`);
}

if (echecs > 0) process.exit(1);
console.log("[eas-env] tous les profils distribuables sont branchés.");
