import { readFileSync } from 'node:fs';
const places = JSON.parse(readFileSync(new URL('./lieux-abidjan-publics.json', import.meta.url), 'utf8'));
if (places.length !== 155 || new Set(places.map(p => p.id)).size !== places.length) throw Error('Unexpected public snapshot');
const payload = Buffer.from(JSON.stringify(places)).toString('base64');
console.log(`BEGIN;
DO $$ BEGIN IF left(current_database(),6)<>'pilot_' THEN RAISE EXCEPTION 'This seed requires an isolated pilot_ database'; END IF; END $$;
WITH inventory AS (
 SELECT id,name,lat,lng,is_published,city,city_code,descriptive_address,neighborhood,price_tier,cuisine
 FROM jsonb_populate_recordset(NULL::public.places,convert_from(decode('${payload}','base64'),'UTF8')::jsonb)
)
INSERT INTO public.places (id,name,lat,lng,is_published,city,city_code,descriptive_address,neighborhood,price_tier,cuisine)
SELECT id,name,lat,lng,is_published,city,city_code,descriptive_address,neighborhood,price_tier,cuisine FROM inventory
ON CONFLICT(id) DO UPDATE SET name=excluded.name,lat=excluded.lat,lng=excluded.lng,city=excluded.city,city_code=excluded.city_code,
 is_published=excluded.is_published,descriptive_address=excluded.descriptive_address,neighborhood=excluded.neighborhood,
 price_tier=excluded.price_tier,cuisine=excluded.cuisine;
COMMIT;`);
