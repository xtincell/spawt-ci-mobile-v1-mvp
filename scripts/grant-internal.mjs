#!/usr/bin/env node
// =============================================================================
// SPAWT — désigner un compte app comme « compte interne »
// =============================================================================
// Un compte interne (`spawters.is_internal`, migration 0060) déverrouille le
// menu « Mode interne » dans les réglages de l'app : bascule entre l'expérience
// gratuite et l'expérience Spawter Gold, aperçu du paywall géographique
// (rayon gratuit 3 km), choix du scope des feature flags. Il n'ouvre AUCUNE
// donnée d'autrui et ne touche à aucun droit facturé.
//
// ── Pourquoi ça passe par le numéro et pas par le compte ────────────────────
// Un compte interne doit pouvoir être désigné AVANT sa première connexion :
// personne ne peut « attraper » l'instant de l'inscription pour basculer un
// interrupteur. On autorise donc des numéros. À la création du compte, un
// trigger serveur lit la liste et pose le statut ; les comptes déjà créés sont
// rattrapés par ce script au moment de l'ajout.
//
// Le sens inverse — retirer le statut — se fait aussi depuis la page Comptes de
// la console admin (RPC `set_spawter_internal`, journalisée). Ce script est le
// chemin d'amorçage, pas le chemin quotidien.
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   export SUPABASE_URL=https://api.spawt.online
//   export SERVICE_ROLE_KEY=<clé service_role>
//
//   node scripts/grant-internal.mjs --list
//   node scripts/grant-internal.mjs --add    +2250700000000 --note "Stéphanie"
//   node scripts/grant-internal.mjs --remove +2250700000000
//
// `--remove` retire le numéro de la liste ET le statut du compte s'il existe :
// une autorisation retirée doit cesser de produire ses effets, sinon la liste
// ne décrit plus la réalité.
// =============================================================================

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? "";

const log = (...a) => console.log("[interne]", ...a);
const fail = (m) => {
  console.error("[interne] ERREUR :", m);
  process.exit(1);
};

if (!SUPABASE_URL) fail("SUPABASE_URL non défini.");
if (!SERVICE_ROLE_KEY) fail("SERVICE_ROLE_KEY non défini.");

const args = process.argv.slice(2);
const valueOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

/** SQL via postgres-meta — même chemin que le migrateur HTTP. */
async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) fail(`SQL ${res.status} : ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : [];
}

/** Littéral SQL — doublement des quotes, seul échappement nécessaire ici
 *  (les entrées sont un numéro validé par regex et une note libre). */
const lit = (s) => (s === undefined || s === null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

const PHONE_RE = /^\+[1-9]\d{7,14}$/;

async function list() {
  const rows = await sql(`
    SELECT a.phone_e164, a.note, a.created_at,
           s.id AS spawter_id, s.display_name, s.is_internal
      FROM public.internal_phone_allowlist a
      LEFT JOIN public.spawters s ON s.phone_e164 = a.phone_e164
     ORDER BY a.created_at`);
  if (rows.length === 0) {
    log("aucun numéro autorisé.");
  } else {
    log(`${rows.length} numéro(s) autorisé(s) :`);
    for (const r of rows) {
      const compte = r.spawter_id
        ? `${r.display_name} — statut ${r.is_internal ? "ACTIF" : "⚠️ NON POSÉ"}`
        : "pas encore inscrit (le statut sera posé à l'inscription)";
      log(`  ${r.phone_e164.padEnd(16)} ${(r.note ?? "").padEnd(24)} ${compte}`);
    }
  }
  // Un compte peut être interne sans être dans la liste : octroi fait à la main
  // depuis la console admin. On le montre, sinon l'inventaire ment.
  const hors = await sql(`
    SELECT s.phone_e164, s.display_name FROM public.spawters s
     WHERE s.is_internal
       AND NOT EXISTS (SELECT 1 FROM public.internal_phone_allowlist a
                        WHERE a.phone_e164 = s.phone_e164)`);
  if (hors.length > 0) {
    log(`${hors.length} compte(s) interne(s) hors liste (octroi console admin) :`);
    for (const r of hors) log(`  ${r.phone_e164.padEnd(16)} ${r.display_name}`);
  }
}

async function add(phone, note) {
  if (!PHONE_RE.test(phone)) fail(`numéro invalide (attendu E.164, ex. +2250700000000) : ${phone}`);
  await sql(`
    INSERT INTO public.internal_phone_allowlist (phone_e164, note)
    VALUES (${lit(phone)}, ${lit(note)})
    ON CONFLICT (phone_e164) DO UPDATE SET note = EXCLUDED.note`);
  // Rattrapage : le compte peut déjà exister.
  const done = await sql(`
    UPDATE public.spawters SET is_internal = true
     WHERE phone_e164 = ${lit(phone)} AND NOT is_internal
     RETURNING id, display_name`);
  log(`${phone} autorisé.`);
  if (done.length > 0) log(`  compte existant mis à jour : ${done[0].display_name}`);
  else log("  aucun compte existant — le statut sera posé à l'inscription.");
}

async function remove(phone) {
  if (!PHONE_RE.test(phone)) fail(`numéro invalide : ${phone}`);
  await sql(`DELETE FROM public.internal_phone_allowlist WHERE phone_e164 = ${lit(phone)}`);
  const done = await sql(`
    UPDATE public.spawters SET is_internal = false
     WHERE phone_e164 = ${lit(phone)} AND is_internal
     RETURNING id, display_name`);
  log(`${phone} retiré de la liste.`);
  if (done.length > 0) log(`  statut retiré du compte : ${done[0].display_name}`);
}

const main = async () => {
  if (args.includes("--list")) return list();
  const toAdd = valueOf("--add");
  if (toAdd) return add(toAdd, valueOf("--note"));
  const toRemove = valueOf("--remove");
  if (toRemove) return remove(toRemove);
  fail("usage : --list | --add <+E164> [--note …] | --remove <+E164>");
};

main().catch((e) => fail(e.message));
