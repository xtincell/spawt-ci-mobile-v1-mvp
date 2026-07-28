#!/usr/bin/env node
// =============================================================================
// SPAWT — création d'un compte de la console admin
// =============================================================================
// La migration 0001 n'autorise AUCUN INSERT client sur `spawt_staff` (c'est
// voulu : on ne s'auto-promeut pas administrateur). Conséquence : sur une base
// fraîche, `spawt_staff` est vide et **personne ne peut se connecter à la
// console**. Ni ouvrir la modération, ni charger l'inventaire — la Edge
// Function `seed-inventory` exige un JWT de staff `admin`.
//
// Il manquait le script qui amorce le premier compte. Le voici.
//
// Deux écritures, dans cet ordre :
//   1. `auth.users` via l'API admin de GoTrue (pour que le hash du mot de passe
//      soit calculé par GoTrue lui-même — ne jamais l'écrire à la main en SQL) ;
//   2. `public.spawt_staff`, même id, avec le rôle.
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   export SUPABASE_URL=https://api.spawt.online
//   export SERVICE_ROLE_KEY=<clé service_role>
//
//   node scripts/create-staff-account.mjs --email a@b.com --role admin
//   node scripts/create-staff-account.mjs --email a@b.com --role admin --password '…'
//   node scripts/create-staff-account.mjs --list
//
// Sans --password, un mot de passe fort est généré et affiché UNE fois : il
// n'est stocké nulle part, à consigner immédiatement dans le gestionnaire de
// mots de passe de l'équipe.
//
// Rôles (CHECK en base) : admin | moderator | operator.
// =============================================================================

import { randomBytes } from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ?? "";

const log = (...a) => console.log("[staff]", ...a);
const fail = (m) => {
  console.error("[staff] ERREUR :", m);
  process.exit(1);
};

if (!SUPABASE_URL) fail("SUPABASE_URL non défini.");
if (!SERVICE_ROLE_KEY) fail("SERVICE_ROLE_KEY non défini.");

const args = process.argv.slice(2);
const valueOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

/** SQL arbitraire via postgres-meta (même chemin que le migrateur HTTP). */
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
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL HTTP ${res.status} — ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

const lit = (s) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

async function listStaff() {
  const rows = await sql(`
    SELECT s.email, s.display_name, s.role, s.is_active, s.created_at
    FROM public.spawt_staff s ORDER BY s.created_at`);
  if (rows.length === 0) {
    log("aucun compte staff — personne ne peut se connecter à la console.");
    return;
  }
  log(`${rows.length} compte(s) :`);
  for (const r of rows) {
    log(`  ${r.email.padEnd(34)} ${r.role.padEnd(10)} ${r.is_active ? "actif" : "DÉSACTIVÉ"}  ${r.display_name}`);
  }
}

async function main() {
  if (args.includes("--list")) return listStaff();

  const email = valueOf("--email");
  const role = valueOf("--role") ?? "admin";
  const displayName = valueOf("--name") ?? (email ? email.split("@")[0] : null);
  if (!email) fail("--email requis.");
  if (!["admin", "moderator", "operator"].includes(role)) {
    fail(`--role invalide : ${role} (admin | moderator | operator)`);
  }

  // Mot de passe : fourni, ou généré fort. base64url d'un aléa 24 octets —
  // aucune ambiguïté de saisie, entropie largement suffisante.
  const generated = !valueOf("--password");
  const password = valueOf("--password") ?? randomBytes(24).toString("base64url");

  // ── 1. Compte d'authentification (GoTrue calcule le hash) ────────────────
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true, // pas de boîte mail à relever pour un compte interne
      user_metadata: { staff: true, role },
    }),
  });
  const body = await res.text();
  let userId = null;
  if (res.ok) {
    userId = JSON.parse(body).id;
    log(`compte d'authentification créé : ${email}`);
  } else if (res.status === 422 || /already been registered|already exists/i.test(body)) {
    // Idempotence : on récupère l'id existant et on (re)pose la ligne staff.
    const rows = await sql(`SELECT id FROM auth.users WHERE email = ${lit(email)}`);
    if (!rows[0]) fail(`compte existant mais introuvable : ${body.slice(0, 200)}`);
    userId = rows[0].id;
    log(`compte d'authentification déjà présent — réutilisé.`);
  } else {
    fail(`création GoTrue : HTTP ${res.status} ${body.slice(0, 300)}`);
  }

  // ── 2. Ligne staff ───────────────────────────────────────────────────────
  await sql(`
    INSERT INTO public.spawt_staff (id, email, display_name, role, is_active)
    VALUES (${lit(userId)}, ${lit(email)}, ${lit(displayName)}, ${lit(role)}, true)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email, display_name = EXCLUDED.display_name,
          role = EXCLUDED.role, is_active = true, updated_at = now();`);
  log(`ligne staff posée : rôle ${role}`);

  if (generated) {
    console.log("");
    console.log("  ┌──────────────────────────────────────────────────────────");
    console.log(`  │ email        : ${email}`);
    console.log(`  │ mot de passe : ${password}`);
    console.log("  └──────────────────────────────────────────────────────────");
    console.log("  Affiché UNE seule fois — il n'est stocké nulle part.");
    console.log("");
  }
  await listStaff();
}

main().catch((e) => fail(e.message));
