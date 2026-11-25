import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const accounts=JSON.parse(readFileSync(new URL('./comptes-test.json',import.meta.url),'utf8'));
const key='sb_publishable_spawt_abidjan_local_recette';
const base='http://127.0.0.1:54321';
async function request(path,{token=key,method='GET',json}={}){
 const response=await fetch(base+path,{method,headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},body:json?JSON.stringify(json):undefined});
 const raw=await response.text();if(!response.ok)throw Error(method+' '+path.split('?')[0]+': '+response.status+' '+raw);
 return raw?JSON.parse(raw):null;
}
const id='c5acfd12-01dd-5cd3-9beb-0531d89c3e99';
const [place]=await request('/rest/v1/places?id=eq.'+id+'&select=*,last_spawt_at,place_adn(*)');
assert.equal(place.name,'IN’ Concept Store');
assert.equal(place.price_tier,null); assert.equal(place.avg_ticket_xof,null);
assert.equal(place.descriptive_address,'Boulevard des Martyrs');
assert.equal(place.place_adn.place_id,id);
for(const account of accounts){
 const phone={phone_e164:account.phone};
 const send=await request('/functions/v1/otp-send',{method:'POST',json:phone});assert.match(send.request_id,/^mock-/);
 const auth=await request('/functions/v1/otp-verify',{method:'POST',json:{...phone,otp_code:'123456'}});
 assert.equal(auth.user_id,account.id);
 const opts={token:auth.access_token};
 assert.equal((await request('/auth/v1/user',opts)).id,account.id);
 const [me]=await request('/rest/v1/spawters?id=eq.'+account.id+'&select=*',opts);
 assert.equal(me.id,account.id);assert.equal(me.is_internal,true);assert.equal(me.is_demo,account.demo);
 const [palais]=await request('/rest/v1/user_palais?spawter_id=eq.'+account.id+'&select=*',opts);
 assert.equal(palais.spawter_id,account.id);assert.equal(palais.stade,'touriste');
 const renew=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',json:{refresh_token:auth.refresh_token}});
 assert.equal((await request('/auth/v1/user',{token:renew.access_token})).id,account.id);
}
console.log(JSON.stringify({scope:'isolated HTTP',verifiedAt:new Date().toISOString(),accounts:accounts.length,otp:'local test double',name:place.name,address:place.descriptive_address,priceTier:place.price_tier,averageXof:place.avg_ticket_xof}));
