#!/usr/bin/env node
/**
 * Deux profils synthétiques, sans avis public ni privilège staff/interne.
 * Prévisualise par défaut ; --apply exige une alpha dont le SMS mock est confirmé.
 * SUPABASE_URL + SERVICE_ROLE_KEY restent en environnement, jamais affichés.
 * Fournir SPAWT_DEMO_DISCOVERY_PHONE et SPAWT_DEMO_PALAIS_PHONE (numéros fictifs).
 * Usage : SPAWT_ALPHA_MOCK_CONFIRMED=true node scripts/create-alpha-demo-accounts.mjs --apply
 */
const base = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.SERVICE_ROLE_KEY;
const apply = process.argv.includes('--apply');
const fixtures = [
  { phone: process.env.SPAWT_DEMO_DISCOVERY_PHONE, name: 'Démo Alpha Découverte', neighborhood: 'Cocody', axes: [0, 0, 0, 0, 0], confidence: 0 },
  { phone: process.env.SPAWT_DEMO_PALAIS_PHONE, name: 'Démo Alpha Palais', neighborhood: 'Marcory', axes: [-0.55, 0.4, -0.3, 0.45, -0.5], confidence: 0.35 },
];
const lit = value => `'${String(value).replace(/'/g, "''")}'`;
async function api(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
const sql = query => api('/pg/query', { query });

async function main() {
  if (!base || !key) throw new Error('SUPABASE_URL et SERVICE_ROLE_KEY requis.');
  if (fixtures.some(f => !/^\+22500\d{8}$/.test(f.phone ?? '')) || fixtures[0].phone === fixtures[1].phone) {
    throw new Error('Fournir deux numéros fictifs distincts +22500XXXXXXXX via SPAWT_DEMO_DISCOVERY_PHONE et SPAWT_DEMO_PALAIS_PHONE.');
  }
  if (apply && process.env.SPAWT_ALPHA_MOCK_CONFIRMED !== 'true') {
    throw new Error('Confirmer le SMS mock de cette alpha avec SPAWT_ALPHA_MOCK_CONFIRMED=true.');
  }
  const migration = await sql("SELECT version FROM public.schema_migrations WHERE version='0070_alpha_demo_accounts'");
  if (!migration.length) throw new Error('Appliquer et vérifier la migration 0070 avant de créer les démos.');
  for (const fixture of fixtures) {
    // Refuse toute collision avec un compte réel, y compris une ligne Auth sans profil.
    const rows = await sql(`SELECT a.id, a.raw_app_meta_data->>'alpha_demo' AS marker,
      s.is_demo, s.is_seed, s.is_internal, EXISTS(SELECT 1 FROM public.spawt_staff t WHERE t.id=a.id) AS staff
      FROM auth.users a LEFT JOIN public.spawters s ON s.id=a.id
      WHERE a.phone=${lit(fixture.phone.slice(1))}
         OR a.id IN (SELECT id FROM public.spawters WHERE phone_e164=${lit(fixture.phone)})`);
    if (rows.length > 1 || rows.some(row => row.marker !== 'true' || row.is_demo === false || row.is_seed || row.is_internal || row.staff)) {
      throw new Error(`Collision protégée pour ${fixture.phone} : aucune modification.`);
    }
    if (rows[0]?.is_demo) {
      console.log(`${fixture.name} : existe déjà (${fixture.phone}), contenu conservé.`);
      continue;
    }
    if (!apply) {
      console.log(`${fixture.name} : à créer (${fixture.phone}).`);
      continue;
    }
    // GoTrue renseigne tous les jetons requis ; aucune écriture SQL dans auth.users.
    const account = rows[0] ?? await api('/auth/v1/admin/users', {
      phone: fixture.phone, phone_confirm: true,
      app_metadata: { alpha_demo: true }, user_metadata: { display_name: fixture.name },
    });
    if (!/^[a-f0-9-]{36}$/i.test(account.id ?? '')) throw new Error('Identifiant Auth inattendu.');
    await sql(`BEGIN;
      INSERT INTO public.spawters (id,phone_e164,display_name,neighborhood,country_code,is_demo)
      VALUES (${lit(account.id)},${lit(fixture.phone)},${lit(fixture.name)},${lit(fixture.neighborhood)},'CI',true);
      INSERT INTO public.user_palais (spawter_id,axe_racines_horizons,axe_taniere_nomade,
        axe_exigeant_enthousiaste,axe_foule_secret,axe_maquis_table,confidence_score)
      VALUES (${lit(account.id)},${fixture.axes.join(',')},${fixture.confidence});
      COMMIT;`);
    console.log(`${fixture.name} : créé (${fixture.phone}), aucun SMS envoyé.`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
