// Read-only check of the actual TypeScript adapter against the configured API.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../app/node_modules/typescript');
const { createClient } = require('../app/node_modules/@supabase/supabase-js');
const env = require('../app/eas.json').build.preview.env;
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const cache = new Map();
function load(name) {
  if (name === './supabase') return { supabase };
  if (name === './upload-body') return { readUploadBody() { throw Error('Read-only audit'); } };
  if (cache.has(name)) return cache.get(name);
  const filename = path.resolve('app/src/lib', name + '.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', code)(load, module, module.exports, false);
  cache.set(name, module.exports);
  return module.exports;
}
(async () => {
  const { listCommunityPageFromSupabase } = load('./community.supabase');
  const assert = require('node:assert/strict');
  const all = await listCommunityPageFromSupabase({ limit: 50 });
  const first = await listCommunityPageFromSupabase({ limit: 1 });
  const second = first.next ? await listCommunityPageFromSupabase({ limit: 1, cursor: first.next }) : {items:[]};
  assert(!second.items.some(x => first.items.some(y => y.id === x.id && y.kind === x.kind)));
  const coups = await listCommunityPageFromSupabase({ filter: 'coup' });
  const reviews = await listCommunityPageFromSupabase({ filter: 'review' });
  assert(coups.items.every(x=>x.kind==='coup'));
  assert(reviews.items.every(x=>x.kind==='review'));
  const old = await supabase.from('coups_de_coeur').select('id,spawters_public:spawters!inner(display_name,avatar_url)');
  const report = { checkedAt:new Date().toISOString(), endpoint:env.EXPO_PUBLIC_SUPABASE_URL, total:all.items.length, reviews:reviews.items.length, coups:coups.items.length, oldCoupQuery:old.data?.length, paginationNoDuplicate:true, writes:0 };
  fs.mkdirSync('outputs/bande-v1-2026-10-13',{recursive:true});
  fs.writeFileSync('outputs/bande-v1-2026-10-13/live-read-proof.json',JSON.stringify(report,null,2));
  // Public activity only, used for a truthful browser capture; no PII or session.
  fs.writeFileSync('outputs/bande-v1-2026-10-13/public-activity.json',JSON.stringify(all,null,2));
  console.log(JSON.stringify(report));
})().catch(e=>{ console.error(e);process.exitCode=1;});
