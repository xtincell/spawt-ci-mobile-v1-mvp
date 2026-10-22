#!/usr/bin/env node
// =============================================================================
// SPAWT — rendre `eas.json` autoritaire sur le backend embarqué
// =============================================================================
// Le problème, mesuré sur un téléphone réel.
//
// `app/eas.json` déclarait la bonne clé anonyme (169 caractères). L'APK
// installé en envoyait une autre (208 caractères, celle d'un ancien projet
// Supabase cloud supprimé). L'app le dit elle-même, depuis `backend-identity` :
//
//     clé eyJhbGci…2aZEwA (208) [build]
//
// `[build]` = la valeur vient d'une variable d'environnement figée au moment du
// bundle. Or EAS superpose plusieurs couches à ce moment-là : le bloc `env` du
// profil, les variables stockées côté serveur EAS, et les secrets legacy. Les
// couches serveur gagnent, sans laisser la moindre trace dans le dépôt ni dans
// les logs. Le dépôt disait vrai, le binaire faisait autre chose, et les deux
// étaient invérifiables l'un contre l'autre.
//
// Le correctif. `app/src/lib/backend-identity.ts` donne la priorité au
// **manifeste** (`app.json` → `extra`) sur les variables de build. Ce script
// recopie donc, avant le build, les valeurs du profil visé depuis `eas.json`
// vers le manifeste. Ce qui est écrit dans le dépôt gagne alors sur ce qui
// traîne côté serveur EAS — quelle que soit la couche qui traîne.
//
// Deux propriétés qui comptent :
//
//   * On ne recopie QUE ce que le profil déclare. Le profil `development` n'a
//     ni URL ni clé (il tourne en démo assumée) : le script retire alors toute
//     valeur résiduelle du manifeste au lieu d'en inventer une. « Rien » reste
//     « rien ».
//   * Le fichier n'est modifié que sur le runner, jamais commité. Le dépôt
//     garde un `app.json` sans backend en dur : un poste de développement
//     continue de lire ses propres variables.
//
// Rien de secret ici : une clé anonyme part dans chaque requête de l'app et est
// lisible dans le binaire. On n'en journalise pas moins que des empreintes.
//
// Usage : node scripts/pin-backend-in-manifest.mjs <profil>
// =============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EAS_JSON = join(HERE, "..", "app", "eas.json");
const APP_JSON = join(HERE, "..", "app", "app.json");

const profil = process.argv[2];
if (!profil) {
  console.error("[pin-backend] usage : node scripts/pin-backend-in-manifest.mjs <profil>");
  process.exit(1);
}

const empreinte = (v) => (v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-6)} (${v.length})` : v);

const eas = JSON.parse(await readFile(EAS_JSON, "utf8"));
const env = eas.build?.[profil]?.env ?? {};
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const cle = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const app = JSON.parse(await readFile(APP_JSON, "utf8"));
app.expo.extra = app.expo.extra ?? {};

if (url && cle) {
  app.expo.extra.supabaseUrl = url;
  app.expo.extra.supabaseAnonKey = cle;
  console.log(`[pin-backend] profil ${profil} → manifeste : ${url} · clé ${empreinte(cle)}`);
  console.log("[pin-backend] le manifeste l'emporte sur toute variable injectée par EAS.");
} else {
  // Profil sans backend (démo assumée) : on n'écrit rien, et on nettoie ce qui
  // aurait pu rester d'un build précédent sur le même runner.
  delete app.expo.extra.supabaseUrl;
  delete app.expo.extra.supabaseAnonKey;
  console.log(`[pin-backend] profil ${profil} → aucun backend déclaré, manifeste laissé vierge.`);
}

await writeFile(APP_JSON, `${JSON.stringify(app, null, 2)}\n`);
