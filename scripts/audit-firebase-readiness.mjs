// Read metadata only: never request token, key, environment value or file content.
import fs from 'node:fs';
const appId='15ac2301-e901-4caa-a8c8-864c6621bcd0';
const packageName='com.upgraders.spawt';
if(!process.env.EXPO_TOKEN) throw new Error('Expo CI access is unavailable');
async function query(query,variables) {
  const response=await fetch('https://api.expo.dev/graphql',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.EXPO_TOKEN},
    body:JSON.stringify({query,variables}),
    signal:AbortSignal.timeout(30000),
  });
  if(!response.ok) throw new Error('Expo metadata HTTP '+response.status);
  const body=await response.json();
  if(body.errors?.length) throw new Error('Expo metadata query failed: '+body.errors.map(e=>e.message).join('; '));
  return body.data;
}
const data=await query(`query($appId:String!,$identifier:String!){app{byId(appId:$appId){id androidAppCredentials(filter:{applicationIdentifier:$identifier}){applicationIdentifier isLegacy androidFcm{id} googleServiceAccountKeyForFcmV1{id projectIdentifier}}}}}`,{appId,identifier:packageName});
const proof={
  checkedAt:new Date().toISOString(),appId,packageName,readOnly:true,
  credentialRecords:data.app.byId.androidAppCredentials.map(c=>({
    packageName:c.applicationIdentifier,isLegacy:c.isLegacy,
    legacyFcmConfigured:Boolean(c.androidFcm),fcmV1Configured:Boolean(c.googleServiceAccountKeyForFcmV1),
    firebaseProjectId:c.googleServiceAccountKeyForFcmV1?.projectIdentifier??null,
  })),
};
try {
  const env=await query(`query($appId:String!){app{byId(appId:$appId){environmentVariables{name type visibility environments} ownerAccount{environmentVariables{name type visibility environments}}}}}`,{appId});
  const relevant=items=>items.filter(v=>/FIREBASE|GOOGLE_SERVICES|FCM|GOOGLE_APPLICATION_CREDENTIALS/i.test(v.name)).map(v=>({name:v.name,type:v.type,visibility:v.visibility,environments:v.environments}));
  proof.environmentMetadata={status:'read',project:relevant(env.app.byId.environmentVariables),account:relevant(env.app.byId.ownerAccount.environmentVariables)};
} catch {
  proof.environmentMetadata={status:'unavailable'};
}
fs.mkdirSync('firebase-proof',{recursive:true});
fs.writeFileSync('firebase-proof/expo-firebase-readiness.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
