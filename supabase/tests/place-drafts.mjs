// Exercise the real baseline and migration with PostgreSQL semantics.
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const read = name => fs.readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
await db.exec(read('0010_create_places_place_adn.sql').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
await db.exec(`GRANT SELECT ON places TO anon;
  INSERT INTO places(name,cuisine,lat,lng,descriptive_address,neighborhood,price_tier,is_published)
  VALUES ('Existing published place',ARRAY['ivoirienne'],5.35,-3.97,'Adresse','Cocody',2,true);`);
await db.exec(read('0076_incomplete_place_drafts.sql'));
const { rows: [draft] } = await db.query(`INSERT INTO places(name,descriptive_address,neighborhood)
  VALUES ('Documentary draft','','') RETURNING *`);
assert.equal(draft.lat, null); assert.equal(draft.lng, null); assert.equal(draft.price_tier, null);
assert.equal(draft.is_published, false);
await assert.rejects(() => db.query('UPDATE places SET is_published=true WHERE id=$1', [draft.id]), e => e.code === '23514');
await db.exec('SET ROLE anon');
assert.deepEqual((await db.query('SELECT name FROM places')).rows, [{ name: 'Existing published place' }]);
await db.exec('RESET ROLE');
await assert.rejects(() => db.exec(read('0076_incomplete_place_drafts.down.sql')), /complete_or_export/);
assert.equal((await db.query('SELECT count(*)::int AS n FROM places')).rows[0].n, 2);
await db.query(`UPDATE places SET lat=5.35,lng=-3.97,descriptive_address='Adresse',neighborhood='Cocody',price_tier=2,cuisine=ARRAY['ivoirienne'] WHERE id=$1`, [draft.id]);
await db.query('UPDATE places SET is_published=true WHERE id=$1', [draft.id]);
await db.exec(read('0076_incomplete_place_drafts.down.sql'));
await assert.rejects(() => db.query('UPDATE places SET lat=NULL WHERE id=$1', [draft.id]), e => e.code === '23502');
console.log('PASS: incomplete drafts, publication guard, anonymous isolation, non-destructive rollback, completed publication and restored constraints');
await db.close();
