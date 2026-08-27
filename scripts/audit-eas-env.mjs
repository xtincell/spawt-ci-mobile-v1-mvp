#!/usr/bin/env node
// =============================================================================
// SPAWT — QUI injecte les variables dans un build EAS ?
// =============================================================================
// `app/eas.json` porte un bloc `env` par profil, et on croyait que c'était la
// seule source. C'est faux : EAS superpose au moins trois couches au moment du
// build — le bloc `env` du profil, les **variables d'environnement** stockées
// côté serveur EAS, et les **secrets** EAS (legacy). Les couches serveur
// gagnent, silencieusement, sans que rien n'apparaisse dans le dépôt.
//
// Ce que ça a coûté : un APK qui embarquait une clé anonyme de 208 caractères
// — celle d'un ancien projet Supabase cloud aujourd'hui supprimé — alors que
// `eas.json` en déclarait une de 169, la bonne. Symptôme à l'écran : le code
// OTP est accepté (la route des Edge Functions ne vérifie aucune clé côté
// passerelle) puis la session refuse de s'ouvrir en « Unauthorized », et toute
// lecture de données aurait échoué pour la même raison. Rien, ni dans le
// dépôt ni dans les logs de build, ne nommait la cause.
//
// Ce script rend les couches visibles. Il ne modifie rien.
//
// Sur les valeurs : les variables `EXPO_PUBLIC_*` sont publiques par
// construction — elles partent dans chaque requête de l'app et sont lisibles
// dans le binaire. On n'en recopie pas moins jamais une valeur entière dans un
// log de CI : tout ce qui ressemble à un jeton est réduit à une empreinte
// (8 premiers, 6 derniers, longueur). Assez pour comparer, jamais assez pour
// réutiliser. `eas secret:list` n'expose de toute façon que des noms.
//
// Usage : node scripts/audit-eas-env.mjs [environnement]   (défaut : preview)
// =============================================================================

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "app");
const ENVIRONNEMENT = process.argv[2] ?? "preview";

/**
 * Réduit toute suite assez longue de caractères base64url à une empreinte.
 * Le seuil (32) laisse passer les valeurs courtes et lisibles — `true`, une
 * URL, un identifiant de projet — et n'attrape que ce qui ressemble à un jeton.
 */
function masquer(texte) {
  return texte.replace(/[A-Za-z0-9_\-.]{32,}/g, (v) => `${v.slice(0, 8)}…${v.slice(-6)} (${v.length})`);
}

function lancer(titre, args) {
  console.log(`\n─── ${titre} ${"─".repeat(Math.max(0, 60 - titre.length))}`);
  try {
    const sortie = execFileSync("eas", args, {
      cwd: APP_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log(masquer(sortie).trimEnd() || "(vide)");
  } catch (e) {
    // Une sous-commande absente d'une version d'eas-cli ne doit pas faire
    // échouer l'audit : on veut les couches qu'on PEUT lire.
    const detail = masquer(String(e.stdout ?? "") + String(e.stderr ?? "") || e.message);
    console.log(`(indisponible) ${detail.trimEnd().slice(0, 400)}`);
  }
}

console.log(`[audit-eas] couches de variables vues par le build — environnement « ${ENVIRONNEMENT} »`);
console.log("[audit-eas] rappel : les couches serveur EAS gagnent sur le bloc `env` d'eas.json.");

lancer("Variables d'environnement EAS (côté serveur)", [
  "env:list",
  "--environment",
  ENVIRONNEMENT,
  "--non-interactive",
]);
lancer("Secrets EAS (legacy — noms seulement)", ["secret:list", "--non-interactive"]);
