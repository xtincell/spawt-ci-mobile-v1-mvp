import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../app/package.json',import.meta.url));
const ts = require('typescript');
let response = null; let failing = false; const calls=[];
function load(name, imports={}) {
 const exports={}; const source=fs.readFileSync(new URL('../supabase/functions/public-share/'+name,import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,require:n=>imports[n],URL,Request,Response,AbortSignal,Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://api.example.test':'public-anon'},serve:()=>{}},fetch:async(url,options)=>{calls.push({url,options}); if(failing)throw new Error('offline'); return Response.json(response); }});
 return exports;
}
const render=load('render.ts');
const {handlePublicShare}=load('index.ts',{'./render.ts':render});
const token='00000000-0000-4000-8000-000000000001';
const url=`https://api.example.test/functions/v1/public-share?kind=liste&id=${token}`;
let result=await handlePublicShare(new Request(url)); assert.equal(result.status,404);
response={title:'<script>alert(1)</script>',items:[{place_id:token,place_name:'Lieu <test>',photo_url:'javascript:alert(2)'}]};
result=await handlePublicShare(new Request(url,{headers:{Authorization:'Bearer private-client-identity'}}));
const html=await result.text(); assert.equal(result.status,200); assert(!html.includes('<script>')); assert(!html.includes('javascript:')); assert(html.includes('Lieu &lt;test&gt;')); assert(html.includes('property="og:title"'));
assert.equal(result.headers.get('cache-control'),'no-store'); assert.equal(calls.at(-1).options.headers.Authorization,'Bearer public-anon');
assert.equal((await handlePublicShare(new Request(url,{method:'HEAD'}))).status,200);
assert.equal(await (await handlePublicShare(new Request(url,{method:'HEAD'}))).text(),'');
failing=true; assert.equal((await handlePublicShare(new Request(url))).status,503);
assert.equal((await handlePublicShare(new Request(url,{method:'POST'}))).status,405);
assert.equal((await handlePublicShare(new Request(url.replace(token,'invalid')))).status,404);
console.log('PASS public sharing: revoked link, anonymous identity, escaped HTML/metadata, HEAD, outage, invalid input');
