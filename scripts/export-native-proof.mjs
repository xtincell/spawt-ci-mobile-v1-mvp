import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const config=JSON.parse(fs.readFileSync('documentation/android-proof-export.json','utf8'));
if(!Number.isSafeInteger(config.run) || config.build!==41) throw new Error('Invalid receipt recipe');
const repo=process.env.GITHUB_REPOSITORY;
if(repo!=='xtincell/spawt-ci-mobile-v1-mvp') throw new Error('Unexpected repository');
const api='https://api.github.com/repos/'+repo;
const headers={authorization:'Bearer '+process.env.GH_TOKEN,accept:'application/vnd.github+json','content-type':'application/json'};
async function request(path,body){
 const response=await fetch(api+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok) throw new Error(path+' HTTP '+response.status);
 return response.json();
}
const run=await request('/actions/runs/'+config.run);
if(run.path!=='.github/workflows/android-qa.yml' || run.status!=='completed') throw new Error('Not a completed native QA run');
execFileSync('gh',['run','download',String(config.run),'--repo',repo,'--name','android-proof','--dir','native-proof'],{stdio:'inherit'});
const meta=JSON.parse(fs.readFileSync('native-proof/apk-metadata.json'));
if(meta.build!==config.build || meta.sourceCommit!==config.sourceCommit) throw new Error('Artifact source mismatch');
// Only explicit screenshots and receipt JSON. Never export sessions, logs,
// Android package dumps, navigation URLs or arbitrary artifact files.
const names=['apk-metadata.json','assertions.json','live-data.json','outing-data.json','upgrade-install.json','firebase-runtime.json','opening-visibility.json','live-home-393-1.png','live-home-320-1.3.png','live-content-checks.png','live-feedback-team-reply.png','live-menu-contribution-received.png','live-menu-contribution-rejected.png','live-contribution-reward.png','live-contribution-paws-ledger.png','outing-native-menu.png','outing-dish-search.png','outing-offline-save.png','outing-offline-restart.png','outing-named-list.png','outing-before-share.png','outing-share-result.png','outing-before-revoke.png','outing-revoke-received.png','outing-public-browser.png','outing-revoked-browser.png','outing-app-link.png','last-state.png','last-state.xml'];
const prefix=`receipts/build-${config.build}/${config.run}/`;
const tree=await Promise.all(names.filter(n=>fs.existsSync('native-proof/'+n)).map(async name=>{
 const blob=await request('/git/blobs',{content:fs.readFileSync('native-proof/'+name).toString('base64'),encoding:'base64'});
 return {path:prefix+name,mode:'100644',type:'blob',sha:blob.sha};
}));
const readme=`# Réception Android ${config.build}\n\nSource : ${run.html_url}\n\nRésultat de cette recette : **${run.conclusion}**. Une recette exportée n’est pas une publication de l’APK.\n\nAPK : ${meta.sha256}\n\nCes captures concernent uniquement le compte synthétique de recette et les contenus publics de SPAWT.\n`;
const blob=await request('/git/blobs',{content:readme,encoding:'utf-8'});tree.push({path:prefix+'README.md',mode:'100644',type:'blob',sha:blob.sha});
const refPath='/git/ref/heads/android-receipts';let ref;
const lookup=await fetch(api+refPath,{headers});
if(lookup.status===404){await request('/git/refs',{ref:'refs/heads/android-receipts',sha:process.env.GITHUB_SHA});ref=await request(refPath);}else if(lookup.ok)ref=await lookup.json();else throw new Error('Receipt ref lookup failed');
const parent=await request('/git/commits/'+ref.object.sha);
const created=await request('/git/trees',{base_tree:parent.tree.sha,tree});
const commit=await request('/git/commits',{message:`Receive Android ${config.build} QA ${config.run} (${run.conclusion})`,tree:created.sha,parents:[ref.object.sha]});
const update=await fetch(api+'/git/refs/heads/android-receipts',{method:'PATCH',headers,body:JSON.stringify({sha:commit.sha,force:false})});
if(!update.ok)throw new Error('Concurrent receipt update; retry safely');
console.log(`https://github.com/${repo}/tree/android-receipts/${prefix}`);
