#!/usr/bin/env node
// =============================================================================
// SPAWT — faire suivre les variables du serveur EAS à ce que dit le dépôt
// =============================================================================
// EAS stocke, en plus du bloc `env` d'`eas.json`, un jeu de variables par
// environnement (production / preview / development), modifiable depuis le
// tableau de bord. Les deux portent les mêmes noms. Les logs de build le
// disent explicitement :
//
//   Environment variables ... loaded from the "preview" environment on EAS:
//     EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_SUPABASE_URL
//   The following ... are defined in both ... The values from the build
//   profile configuration will be used.
//
// Deux sources pour la même valeur, dont une invisible depuis le dépôt : c'est
// la condition d'une dérive silencieuse, et elle s'est produite. Le jeu stocké
// côté EAS pointait encore sur un projet Supabase supprimé.
//
// Ce script fait suivre le serveur au dépôt. Direction volontaire et pas
// l'inverse : `eas.json` est versionné, relu, et sa clé vient d'être VÉRIFIÉE
// contre la vraie passerelle par `check-eas-env.mjs` — on ne pousse donc
// jamais qu'une valeur dont on a la preuve qu'elle fonctionne. La copie du
// tableau de bord, elle, n'a ni historique ni revue.
//
// `env:create --force` crée ou écrase : l'opération est idempotente, on peut la
// rejouer à chaque build sans effet de bord. Rien n'est supprimé.
//
// Ne s'exécute que si `EXPO_TOKEN` est présent (donc en CI) : sans jeton, il
// n'y a rien à synchroniser et le script sort proprement.
//
// Usage : node scripts/sync-eas-env.mjs
// =============================================================================

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(HERE, "..", "app");
const EAS_JSON = join(APP_DIR, "eas.json");

/** Les environnements qu'EAS connaît. Un profil qui n'en porte pas le nom hérite du sien. */
const ENVIRONNEMENTS_EAS = new Set(["production", "preview", "development"]);
const PROFILS_DISTRIBUABLES = ["preview", "production", "preview-ios-device"];
const VARIABLES = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];

const empreinte = (v) => (v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-6)} (${v.length})` : v);

if (!process.env.EXPO_TOKEN) {
  console.log("[sync-eas-env] pas de EXPO_TOKEN — rien à synchroniser, on passe.");
  process.exit(0);
}

const eas = JSON.parse(await readFile(EAS_JSON, "utf8"));

/** Le profil `preview-ios-device` étend `preview` : il vise le même environnement EAS. */
function environnementDe(nomProfil) {
  if (ENVIRONNEMENTS_EAS.has(nomProfil)) return nomProfil;
  const parent = eas.build?.[nomProfil]?.extends;
  return ENVIRONNEMENTS_EAS.has(parent) ? parent : null;
}

// Un même environnement peut être visé par plusieurs profils : on ne le traite
// qu'une fois, et on vérifie au passage que les profils concernés s'accordent.
const parEnvironnement = new Map();
for (const profil of PROFILS_DISTRIBUABLES) {
  const env = eas.build?.[profil]?.env ?? {};
  const cible = environnementDe(profil);
  if (!cible) continue;
  const valeurs = Object.fromEntries(VARIABLES.map((n) => [n, env[n]]).filter(([, v]) => v));
  if (Object.keys(valeurs).length === 0) continue;

  const dejaVu = parEnvironnement.get(cible);
  if (dejaVu) {
    for (const nom of VARIABLES) {
      if (dejaVu.valeurs[nom] && valeurs[nom] && dejaVu.valeurs[nom] !== valeurs[nom]) {
        console.error(
          `[sync-eas-env] ÉCHEC — les profils « ${dejaVu.profil} » et « ${profil} » visent tous deux\n` +
            `              l'environnement « ${cible} » avec des ${nom} différents. Il n'y a pas de\n` +
            `              valeur juste à pousser : corriger eas.json d'abord.`,
        );
        process.exit(1);
      }
    }
    Object.assign(dejaVu.valeurs, valeurs);
    continue;
  }
  parEnvironnement.set(cible, { profil, valeurs });
}

let echecs = 0;
for (const [environnement, { valeurs }] of parEnvironnement) {
  for (const [nom, valeur] of Object.entries(valeurs)) {
    try {
      execFileSync(
        "eas",
        [
          "env:create",
          "--environment",
          environnement,
          "--name",
          nom,
          "--value",
          valeur,
          "--type",
          "string",
          // `plaintext` et non `sensitive` : ces valeurs partent dans chaque
          // requête de l'app et sont lisibles dans le binaire. Les marquer
          // sensibles ne protégerait rien et empêcherait de les relire pour
          // vérifier — ce qui est précisément ce qui a manqué ici.
          "--visibility",
          "plaintext",
          "--force",
          "--non-interactive",
        ],
        { cwd: APP_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      console.log(`[sync-eas-env] ${environnement.padEnd(12)} ${nom} ← ${empreinte(valeur)}`);
    } catch (e) {
      const detail = String(e.stdout ?? "") + String(e.stderr ?? "") || e.message;
      console.error(
        `[sync-eas-env] ${environnement.padEnd(12)} ${nom} — échec : ${detail.trim().slice(0, 200)}`,
      );
      echecs += 1;
    }
  }
}

if (echecs > 0) {
  // On n'arrête pas le build pour autant : le manifeste épinglé par
  // `pin-backend-in-manifest.mjs` rend l'app immunisée quoi qu'il arrive ici.
  // Cette synchronisation nettoie la source du problème, elle ne le contient
  // pas — confondre les deux ferait échouer des builds parfaitement sains.
  console.warn(`[sync-eas-env] ${echecs} variable(s) non synchronisée(s) — le build continue.`);
  process.exit(0);
}
console.log("[sync-eas-env] le serveur EAS est aligné sur eas.json.");
