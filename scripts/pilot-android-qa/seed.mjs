import {readFileSync} from 'node:fs';
const get=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const place=get('./in-concept-store.json');
const adn=place.place_adn; delete place.place_adn;
const accounts=get('./comptes-test.json');
function asJson(value){return "convert_from(decode('"+Buffer.from(JSON.stringify(value)).toString('base64')+"','base64'),'UTF8')::jsonb";}
function insert(table,key,row){
 const cols=Object.keys(row);
 if(!cols.every(x=>/^[a-z0-9_]+$/.test(x)))throw Error('Invalid column');
 return 'INSERT INTO public.'+table+' ('+cols.join(',')+') SELECT '+cols.join(',')+' FROM jsonb_populate_record(NULL::public.'+table+','+asJson(row)+') ON CONFLICT ('+key+') DO UPDATE SET '+cols.filter(c=>c!==key).map(c=>c+'=excluded.'+c).join(',')+';';
}
console.log(`BEGIN;
DO $$ BEGIN IF left(current_database(),6)<>'pilot_' THEN RAISE EXCEPTION 'This recipe requires an isolated pilot_ database'; END IF; END $$;
CREATE TEMP TABLE local_accounts AS SELECT * FROM jsonb_to_recordset(${asJson(accounts)}) AS a(id uuid,phone text,name text,demo boolean);
INSERT INTO auth.users(id) SELECT id FROM local_accounts ON CONFLICT DO NOTHING;
INSERT INTO public.internal_phone_allowlist(phone_e164,note) SELECT phone,'Compte synthétique de recette locale' FROM local_accounts ON CONFLICT DO NOTHING;
-- These four synthetic records model returning users with a previously accepted account.
-- The app restores its consent from the account after native OTP authentication.
INSERT INTO public.spawters(id,phone_e164,display_name,is_internal,is_demo,cgv_accepted_at,geoloc_consent_at)
SELECT id,phone,name,true,demo,transaction_timestamp(),transaction_timestamp() FROM local_accounts
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_palais(spawter_id) SELECT id FROM local_accounts ON CONFLICT(spawter_id) DO NOTHING;
${insert('places','id',place)}
${insert('place_adn','place_id',adn)}
COMMIT;`);
