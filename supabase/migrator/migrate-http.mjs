#!/usr/bin/env node
// =============================================================================
// SPAWT — migrateur SQL via l'API HTTP (postgres-meta derrière Kong)
// =============================================================================
// Même contrat que `migrator/migrate.sh` (conteneur Docker one-shot), mais sans
// exiger d'accès réseau direct au Postgres : tout passe par la route `/pg/query`
// exposée par Kong et protégée par la clé `service_role`.
//
// Pourquoi ce second chemin : sur le VPS Coolify, `supabase-db` ne publie aucun
// port (il n'est joignable que depuis le réseau Docker interne). Le migrateur
// Docker suppose donc soit un accès SSH à la machine, soit un service déclaré
// dans le même réseau. Ce script-ci tourne depuis n'importe où — poste de dev,
// CI, machine d'astreinte — dès lors qu'on a l'URL publique et la clé de
// service. C'est le chemin à privilégier pour une opération ponctuelle.
//
// Garanties (identiques à migrate.sh) :
//   * Idempotent — une migration déjà présente dans public.schema_migrations
//     n'est jamais rejouée.
//   * Atomique — chaque migration part en UNE seule requête simple contenant
//     l'INSERT de version puis le corps SQL. PostgreSQL enveloppe une requête
//     simple multi-instructions dans une transaction implicite : une erreur au
//     milieu annule aussi l'enregistrement de la version.
//   * Anti-course — pg_advisory_xact_lock en tête de chaque migration, même
//     clé que migrate.sh (727270001) : les deux migrateurs se sérialisent entre
//     eux.
//   * Fail-fast — première erreur SQL = arrêt immédiat, code de sortie 1.
//
// ── Le piège du parc existant (à lire avant de lancer) ───────────────────────
// Une base peut avoir des migrations appliquées SANS table schema_migrations
// (schéma posé à la main, ou migrateur branché après coup). Lancer le migrateur
// tel quel rejouerait 0001 sur un schéma déjà peuplé → échec.
// D'où `--baseline <version>` : il ENREGISTRE les migrations jusqu'à <version>
// incluse comme appliquées, SANS exécuter leur SQL. À n'utiliser qu'une fois,
// après avoir vérifié que le schéma correspond réellement.
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   export SUPABASE_URL=https://api.spawt.online
//   export SERVICE_ROLE_KEY=<clé service_role>
//
//   node migrator/migrate-http.mjs --status                  # état, sans rien écrire
//   node migrator/migrate-http.mjs --baseline 0030_places_menu_urls
//   node migrator/migrate-http.mjs --dry-run                 # liste ce qui serait appliqué
//   node migrator/migrate-http.mjs                           # applique les manquantes
// =============================================================================

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? join(HERE, "..", "migrations");
/** Même clé que migrate.sh — les deux migrateurs doivent se bloquer mutuellement. */
const LOCK_KEY = 727270001;

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? "";

const log = (...a) => console.log("[migrate]", ...a);
const fail = (msg) => {
  console.error("[migrate] ERREUR :", msg);
  process.exit(1);
};

if (!SUPABASE_URL) fail("SUPABASE_URL non défini.");
if (!SERVICE_ROLE_KEY) fail("SERVICE_ROLE_KEY non défini.");

/**
 * Exécute du SQL arbitraire via postgres-meta.
 * Renvoie le tableau de lignes (postgres-meta renvoie le résultat de la
 * DERNIÈRE instruction quand la requête en contient plusieurs).
 */
async function query(sql) {
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    // postgres-meta renvoie {error: "..."} ou {message: "..."} selon le cas.
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.error ?? j.message ?? text;
    } catch {
      /* on garde le texte brut */
    }
    throw new Error(`HTTP ${res.status} — ${detail}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

/** Liste les migrations du dossier, triées, en excluant les .down.sql. */
async function listMigrations() {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((f) => /^\d{4}_.+\.sql$/.test(f) && !f.endsWith(".down.sql"))
    .sort()
    .map((f) => ({ file: f, version: f.replace(/\.sql$/, "") }));
}

async function appliedVersions() {
  const rows = await query(
    "SELECT version FROM public.schema_migrations ORDER BY version",
  );
  return new Set(rows.map((r) => r.version));
}

/** Littéral SQL simple-quoté — les versions sont des [a-z0-9_], pas d'injection réelle. */
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);`);
}

async function main() {
  const args = process.argv.slice(2);
  const has = (f) => args.includes(f);
  const valueOf = (f) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const migrations = await listMigrations();
  if (migrations.length === 0) fail(`aucune migration trouvée dans ${MIGRATIONS_DIR}`);

  await ensureTable();
  const done = await appliedVersions();
  const pending = migrations.filter((m) => !done.has(m.version));

  if (has("--status")) {
    log(`${migrations.length} migrations dans le dépôt`);
    log(`${done.size} appliquées, ${pending.length} en attente`);
    for (const m of pending) log(`  en attente : ${m.version}`);
    return;
  }

  // ── Mode baseline : marquer comme appliquées sans exécuter ────────────────
  const baseline = valueOf("--baseline");
  if (baseline) {
    const idx = migrations.findIndex((m) => m.version === baseline);
    if (idx < 0) fail(`--baseline : version inconnue « ${baseline} »`);
    const toStamp = migrations.slice(0, idx + 1).filter((m) => !done.has(m.version));
    if (toStamp.length === 0) {
      log("baseline : rien à enregistrer, tout est déjà suivi.");
      return;
    }
    log(`baseline jusqu'à ${baseline} — ${toStamp.length} versions à ENREGISTRER`);
    log("            (leur SQL n'est PAS exécuté — le schéma est supposé déjà en place)");
    const values = toStamp.map((m) => `(${lit(m.version)})`).join(",\n  ");
    await query(
      `INSERT INTO public.schema_migrations (version) VALUES\n  ${values}\nON CONFLICT (version) DO NOTHING;`,
    );
    for (const m of toStamp) log(`  enregistrée : ${m.version}`);
    log(`baseline terminée — ${toStamp.length} versions enregistrées.`);
    return;
  }

  // ── Mode normal : appliquer les manquantes ────────────────────────────────
  if (pending.length === 0) {
    log("schéma à jour — aucune migration à appliquer.");
    return;
  }

  if (has("--dry-run")) {
    log(`${pending.length} migrations seraient appliquées :`);
    for (const m of pending) log(`  ${m.version}`);
    return;
  }

  log(`${pending.length} migrations à appliquer.`);
  let applied = 0;
  for (const m of pending) {
    const body = await readFile(join(MIGRATIONS_DIR, m.file), "utf8");
    // Une seule requête simple = une transaction implicite côté PostgreSQL.
    // Le verrou d'abord, l'enregistrement ensuite (la PK sert de garde
    // anti-double application), le corps de la migration en dernier.
    const sql = [
      `SELECT pg_advisory_xact_lock(${LOCK_KEY});`,
      `INSERT INTO public.schema_migrations (version) VALUES (${lit(m.version)});`,
      body,
    ].join("\n");
    try {
      await query(sql);
    } catch (err) {
      console.error(`[migrate] ÉCHEC sur ${m.version}`);
      console.error(`[migrate] ${err.message}`);
      console.error(
        `[migrate] ${applied} migration(s) appliquée(s) avant l'échec ; celle-ci a été annulée.`,
      );
      process.exit(1);
    }
    applied += 1;
    log(`  appliquée : ${m.version}`);
  }
  log(`terminé — ${applied} migration(s) appliquée(s).`);
}

main().catch((err) => fail(err.message));
