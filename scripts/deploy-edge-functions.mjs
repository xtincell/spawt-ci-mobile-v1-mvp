#!/usr/bin/env node
// =============================================================================
// SPAWT — déploiement des Edge Functions sur le stack self-hosted (Coolify)
// =============================================================================
// Remplace la procédure manuelle en SSH qui n'était ni tracée ni reproductible :
// c'est elle qui explique qu'on ait pu tourner des semaines avec 4 fonctions
// déployées sur 9, dans une version périmée, sans que personne ne le voie.
//
// ── Comment les Edge Functions vivent ici ───────────────────────────────────
// Le conteneur `supabase-edge-functions` (image supabase/edge-runtime) monte un
// répertoire de l'hôte sur /home/deno/functions. Un « main service » y route
// /functions/v1/<nom> vers /home/deno/functions/<nom>/index.ts.
// Il n'y a donc PAS de `supabase functions deploy` : déployer = poser des
// fichiers sur l'hôte, puis redémarrer le conteneur.
//
// Coolify expose ces fichiers en API (« file storages ») : on peut donc les
// écrire sans accès SSH, ce que fait ce script.
//
// ── Ce qui est déployé ──────────────────────────────────────────────────────
// Tous les `supabase/functions/<nom>/index.ts` + l'arborescence `_shared/`
// dont ils dépendent. Les `*.test.ts` sont exclus (ils tirent l'API de test de
// Deno, absente du runtime, et n'ont rien à faire en production).
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   export COOLIFY_URL=https://coolify.powerupgraders.com
//   export COOLIFY_TOKEN=<token API Coolify avec droits d'écriture>
//   export COOLIFY_SERVICE_UUID=k4b877n1twp09syxgjg4jc2a       # spawt-supabase
//   export COOLIFY_EDGE_RESOURCE_UUID=v8efc1kj69jnw9t7epkzfznf # supabase-edge-functions
//
//   node scripts/deploy-edge-functions.mjs --dry-run   # liste sans rien écrire
//   node scripts/deploy-edge-functions.mjs             # déploie + redémarre
//   node scripts/deploy-edge-functions.mjs --no-restart
//
// Après déploiement, le contrôle qui compte est dans le récapitulatif : une
// route qui répond 405 (mauvaise méthode) est vivante ; une qui répond 500
// `InvalidWorkerCreation` ne compile pas.
// =============================================================================

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = join(HERE, "..", "supabase", "functions");

// ── Le détail qui fait tout marcher (et qui a coûté un aller-retour) ─────────
// Le conteneur monte UN répertoire de l'hôte :
//     /data/coolify/services/<svc>/volumes/functions  →  /home/deno/functions
// Déposer un fichier dans ce répertoire hôte le rend visible dans le conteneur.
//
// Or, pour un « file storage » créé par l'API, Coolify :
//   * IGNORE le `fs_path` qu'on lui passe (vérifié : il est écrasé) ;
//   * déduit le chemin hôte par simple concaténation
//         /data/coolify/services/<svc> + mount_path ;
//   * et n'ajoute PAS de bind-mount correspondant au docker-compose généré.
//
// Conséquence : passer `mount_path=/home/deno/functions/x/index.ts` écrit le
// fichier dans `<svc>/home/deno/functions/…`, un répertoire que personne ne
// monte — le fichier existe sur l'hôte et le runtime répond
// `InvalidWorkerCreation … could not find an appropriate entrypoint`.
//
// On pilote donc le chemin hôte PAR le mount_path, en visant le répertoire
// réellement monté. Le `mount_path` n'a ici aucune portée (Coolify ne le
// transforme pas en volume) : il ne sert qu'à calculer la destination.
const MOUNT_PREFIX = "/volumes/functions";
/** Chemin réel dans le conteneur, une fois le répertoire monté — pour les logs. */
const CONTAINER_ROOT = "/home/deno/functions";

const COOLIFY_URL = (process.env.COOLIFY_URL ?? "").replace(/\/+$/, "");
const COOLIFY_TOKEN = process.env.COOLIFY_TOKEN ?? "";
const SERVICE_UUID = process.env.COOLIFY_SERVICE_UUID ?? "";
const EDGE_RESOURCE_UUID = process.env.COOLIFY_EDGE_RESOURCE_UUID ?? "";

const log = (...a) => console.log("[edge]", ...a);
const fail = (m) => {
  console.error("[edge] ERREUR :", m);
  process.exit(1);
};

for (const [name, v] of Object.entries({
  COOLIFY_URL,
  COOLIFY_TOKEN,
  COOLIFY_SERVICE_UUID: SERVICE_UUID,
  COOLIFY_EDGE_RESOURCE_UUID: EDGE_RESOURCE_UUID,
})) {
  if (!v) fail(`${name} non défini.`);
}

async function api(method, path, body) {
  const res = await fetch(`${COOLIFY_URL}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${COOLIFY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* réponses vides */
  }
  return { ok: res.ok, status: res.status, json, text };
}

/** Parcourt récursivement un dossier et renvoie les chemins de fichiers. */
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

/**
 * Fichiers à déployer : tous les .ts sauf les tests.
 * Les tests importent `jsr:@std/assert` / `Deno.test`, absents du runtime de
 * production — les embarquer ferait échouer le chargement du worker.
 */
async function filesToDeploy() {
  const all = await walk(FUNCTIONS_DIR);
  return all
    .filter((p) => p.endsWith(".ts") && !p.endsWith(".test.ts"))
    .map((p) => ({
      abs: p,
      rel: relative(FUNCTIONS_DIR, p).split("\\").join("/"),
    }))
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const noRestart = process.argv.includes("--no-restart");

  const files = await filesToDeploy();
  if (files.length === 0) fail(`aucun fichier .ts trouvé sous ${FUNCTIONS_DIR}`);

  const fns = [...new Set(files.map((f) => f.rel.split("/")[0]))].filter(
    (n) => n !== "_shared",
  );
  log(`${files.length} fichiers à déployer, ${fns.length} fonctions : ${fns.join(", ")}`);

  if (dryRun) {
    for (const f of files) log(`  ${CONTAINER_ROOT}/${f.rel}`);
    return;
  }

  // État courant : Coolify renvoie les montages existants ; on met à jour
  // (PATCH par uuid) plutôt que de recréer, sinon on empile des doublons.
  const cur = await api("GET", `/services/${SERVICE_UUID}/storages`);
  if (!cur.ok) fail(`lecture des montages : HTTP ${cur.status} ${cur.text.slice(0, 200)}`);
  const existing = new Map(
    (cur.json?.file_storages ?? []).map((s) => [s.mount_path, s]),
  );

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const f of files) {
    const content = await readFile(f.abs, "utf8");
    const mount_path = `${MOUNT_PREFIX}/${f.rel}`;
    const prev = existing.get(mount_path);

    if (prev && prev.content === content) {
      unchanged += 1;
      continue;
    }

    const res = prev
      ? await api("PATCH", `/services/${SERVICE_UUID}/storages`, {
          uuid: prev.uuid,
          type: "file",
          content,
        })
      : await api("POST", `/services/${SERVICE_UUID}/storages`, {
          type: "file",
          resource_uuid: EDGE_RESOURCE_UUID,
          mount_path,
          content,
        });

    if (!res.ok) {
      fail(`${f.rel} : HTTP ${res.status} ${res.text.slice(0, 300)}`);
    }
    if (prev) {
      updated += 1;
      log(`  mis à jour : ${f.rel}`);
    } else {
      created += 1;
      log(`  créé       : ${f.rel}`);
    }
  }

  log(`${created} créé(s), ${updated} mis à jour, ${unchanged} inchangé(s).`);

  if (noRestart) {
    log("--no-restart : le conteneur n'a PAS été redémarré (les fichiers ne sont pas encore servis).");
    return;
  }
  if (created + updated === 0) {
    log("rien n'a changé — pas de redémarrage.");
    return;
  }

  log("redémarrage du conteneur edge-functions…");
  const r = await api(
    "POST",
    `/services/${SERVICE_UUID}/applications/${EDGE_RESOURCE_UUID}/restart`,
  );
  if (!r.ok) {
    // L'endpoint par sous-ressource n'existe pas sur toutes les versions de
    // Coolify ; on retombe sur le redéploiement du service entier.
    log(`  redémarrage ciblé indisponible (HTTP ${r.status}) — redéploiement du service.`);
    const d = await api("POST", `/deploy?uuid=${SERVICE_UUID}&force=true`);
    if (!d.ok) fail(`redéploiement : HTTP ${d.status} ${d.text.slice(0, 200)}`);
  }
  log("déclenché. Vérifier ensuite que chaque route répond 405 et non 500.");
}

main().catch((e) => fail(e.message));
