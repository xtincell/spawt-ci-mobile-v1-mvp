import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { appendFileSync, readFileSync } from 'node:fs';

export const anonKey = 'sb_publishable_spawt_abidjan_local_recette';
const endpoint = new URL(process.env.PILOT_POSTGREST || 'http://127.0.0.1:55487');
const config = process.env.PILOT_PGRST_CONFIG;
const secret = process.env.PILOT_LOCAL_JWT || (config && readFileSync(config,'utf8').match(/^jwt-secret\s*=\s*"([^"]+)"/m)?.[1]);
if (!secret || !['127.0.0.1','localhost'].includes(endpoint.hostname)) throw Error('An isolated local PostgREST and JWT secret are required.');
const accounts = JSON.parse(readFileSync(new URL('./comptes-test.json',import.meta.url),'utf8'));
const diagnosticRoutes = new Set(['public_menu_items','places','saved_places','rpc/my_outings','rpc/mutate_outing']);
const pending=new Map(), refresh=new Map();
const sign = (claim) => {
  const part=[{alg:'HS256',typ:'JWT'},claim].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  return part+'.'+createHmac('sha256',secret).update(part).digest('base64url');
};
function session(account) {
  const now=Math.floor(Date.now()/1000);
  const jwt=sign({sub:account.id,role:'authenticated',aud:'authenticated',iss:'spawt-local',iat:now,exp:now+3600});
  const token=randomUUID();refresh.set(token,account);
  return {access_token:jwt,token_type:'bearer',refresh_token:token,expires_in:3600,expires_at:now+3600,user:user(account)};
}
function user(account) {
  return {id:account.id,aud:'authenticated',role:'authenticated',phone:account.phone,app_metadata:{provider:'phone',providers:['phone']},
    user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'};
}
function getAccount(header) {
  try {
    const [a,b,s]=String(header).replace(/^Bearer /i,'').split('.');
    const sig=Buffer.from(s,'base64url');const expected=createHmac('sha256',secret).update(a+'.'+b).digest();
    if(sig.length!==expected.length||!timingSafeEqual(sig,expected))return null;
    const claims=JSON.parse(Buffer.from(b,'base64url'));
    return claims.exp> Date.now()/1000 && claims.role==='authenticated' && accounts.find(x=>x.id===claims.sub);
  } catch { return null; }
}
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const routeName=url.pathname.startsWith('/rest/v1/') ? url.pathname.slice('/rest/v1/'.length) : '';
  let errorCode;
  if(process.env.PILOT_HTTP_TRACE && diagnosticRoutes.has(routeName)){
    const started=Date.now();
    const client=String(req.headers['x-client-info'] ?? '').includes('supabase') ? 'sdk' : 'http';
    const role=getAccount(req.headers.authorization) ? 'fixture_user' : 'anonymous_or_invalid';
    res.once('finish',()=>appendFileSync(process.env.PILOT_HTTP_TRACE,JSON.stringify({
      at:new Date().toISOString(),route:routeName,method:req.method,client,role,
      status:res.statusCode,elapsed_ms:Date.now()-started,...(errorCode ? {code:errorCode} : {})
    })+'\n'));
  }
  const origin=req.headers.origin;
  if(origin && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)){res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','origin');}
  res.setHeader('access-control-allow-headers','authorization,apikey,content-type,prefer,accept,range,x-client-info,accept-profile,content-profile');
  res.setHeader('access-control-allow-methods','GET,HEAD,POST,PATCH,DELETE,OPTIONS');
  const send=(code,obj)=>{res.statusCode=code;if(obj===undefined)res.end();else{res.setHeader('content-type','application/json');res.end(JSON.stringify(obj));}};
  if(req.method==='OPTIONS')return send(204);
  try{
    if(url.pathname==='/health')return send(200,{scope:'local-android-recipe'});
    if(req.headers.apikey!==anonKey)return send(401,{message:'Invalid local API key'});
    const payload=[];let length=0;
    for await(const part of req){length+=part.length;if(length>65536)return send(413);payload.push(part);}
    const bytes=Buffer.concat(payload);
    if(url.pathname.startsWith('/rest/v1/')){
      const headers=new Headers();
      for(const name of ['authorization','accept','content-type','accept-profile','content-profile','prefer','range','range-unit','if-match','if-none-match'])if(req.headers[name])headers.set(name,req.headers[name]);
      if(headers.get('authorization')==='Bearer '+anonKey) headers.delete('authorization');
      const route=url.pathname.slice('/rest/v1'.length)+url.search;
      const upstream=await fetch(endpoint.origin+route,{method:req.method,headers,body:bytes.length?bytes:undefined,redirect:'manual'});
      for(const name of ['content-type','content-range','preference-applied','location']){const value=upstream.headers.get(name);if(value)res.setHeader(name,value);}
      const response=Buffer.from(await upstream.arrayBuffer());
      if(!upstream.ok && process.env.PILOT_HTTP_TRACE && diagnosticRoutes.has(routeName)){
        try { const code=JSON.parse(response).code; if(/^(PGRST\d{3}|[0-9A-Z]{5})$/.test(code))errorCode=code; } catch {}
      }
      res.statusCode=upstream.status;res.end(response);return;
    }
    const body=bytes.length?JSON.parse(bytes):{};
    if(url.pathname==='/functions/v1/otp-send'&&req.method==='POST'){
      if(!accounts.some(x=>x.phone===body.phone_e164))return send(400,{error:'test_account_required'});
      pending.set(body.phone_e164,Date.now()+300000);return send(200,{request_id:'mock-'+randomUUID()});
    }
    if(url.pathname==='/functions/v1/otp-verify'&&req.method==='POST'){
      const acc=accounts.find(x=>x.phone===body.phone_e164);
      if(!acc||!(pending.get(acc.phone)>Date.now())||body.otp_code!=='123456')return send(401,{error:'invalid_otp'});
      pending.delete(acc.phone);return send(200,{...session(acc),user_id:acc.id});
    }
    if(url.pathname==='/auth/v1/user'&&req.method==='GET'){
      const acc=getAccount(req.headers.authorization);return acc?send(200,user(acc)):send(401,{message:'Invalid local session'});
    }
    if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='refresh_token'&&req.method==='POST'){
      const acc=refresh.get(body.refresh_token);
      if(!acc)return send(401,{message:'Invalid local refresh'});
      refresh.delete(body.refresh_token);return send(200,session(acc));
    }
    if(url.pathname==='/auth/v1/logout'&&req.method==='POST')return send(204);
    return send(404,{message:'Outside local pilot recipe'});
  }catch(err){return send(502,{message:'Local recipe request failed'});}
});
server.listen(Number(process.env.PILOT_GATEWAY_PORT||54321),'127.0.0.1',()=>console.log('SPAWT pilot gateway on loopback.'));
