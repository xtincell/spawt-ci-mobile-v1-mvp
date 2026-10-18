// One-time bootstrap: GitHub OIDC can create keys only on the dedicated FCM
// account. The private key goes directly to Expo, never to logs or artifacts.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { firebaseIdentity, validateFirebaseConfig } from './check-firebase-config.mjs';
const appId = '15ac2301-e901-4caa-a8c8-864c6621bcd0';
const packageName = firebaseIdentity.packageName;
const serviceEmail = 'spawt-expo-fcm@spawt-ci.iam.gserviceaccount.com';
for (const name of ['EXPO_TOKEN', 'GOOGLE_BOOTSTRAP_TOKEN']) {
  if (!process.env[name]) throw new Error(`Required CI identity missing: ${name}`);
}
validateFirebaseConfig(JSON.parse(fs.readFileSync('app/google-services.json', 'utf8')));
async function gql(query, variables) {
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.EXPO_TOKEN}` },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Expo configuration HTTP ${response.status}`);
  const body = await response.json();
  // GraphQL errors can echo input fields; never log their bodies with credentials.
  if (body.errors?.length || !body.data) throw new Error('Expo configuration operation rejected');
  return body.data;
}
async function validateFcmKey(key) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const assertion = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(30000) });
  if (!tokenResponse.ok) throw new Error(`FCM service account authentication HTTP ${tokenResponse.status}`);
  const token = await tokenResponse.json();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${firebaseIdentity.projectId}/messages:send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.access_token}` },
    body: JSON.stringify({ validate_only: true, message: { topic: 'spawt-configuration-validation', data: { purpose: 'configuration-only' } } }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`FCM validate-only HTTP ${response.status}`);
  return true;
}
const inspect = () => gql(`query($appId:String!,$packageName:String!){app{byId(appId:$appId){id ownerAccount{id name} androidAppCredentials(filter:{applicationIdentifier:$packageName}){id applicationIdentifier isLegacy googleServiceAccountKeyForFcmV1{id projectIdentifier privateKeyIdentifier clientEmail}}}}}`, { appId, packageName });
const before = (await inspect()).app.byId;
if (before.ownerAccount.name !== 'xtincell') throw new Error('Unexpected Expo owner');
const credentials = before.androidAppCredentials.filter(c => !c.isLegacy);
if (credentials.length !== 1) throw new Error('Expected exactly one current Android credential record');
const record = credentials[0];
let stored = record.googleServiceAccountKeyForFcmV1;
let fcmValidateOnlyPassed = false;
if (stored && (stored.projectIdentifier !== firebaseIdentity.projectId || stored.clientEmail !== serviceEmail)) {
  throw new Error('A different FCM credential is already assigned; refusing to replace it');
}
if (!stored) {
  const response = await fetch(`https://iam.googleapis.com/v1/projects/${firebaseIdentity.projectId}/serviceAccounts/${serviceEmail}/keys`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GOOGLE_BOOTSTRAP_TOKEN}` },
    body: JSON.stringify({ privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE', keyAlgorithm: 'KEY_ALG_RSA_2048' }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Google FCM key provisioning HTTP ${response.status}`);
  const created = await response.json();
  const key = JSON.parse(Buffer.from(created.privateKeyData, 'base64').toString('utf8'));
  if (key.type !== 'service_account' || key.project_id !== firebaseIdentity.projectId || key.client_email !== serviceEmail) throw new Error('Unexpected Google service account');
  console.log(JSON.stringify({ createdKeyName: created.name }));
  fcmValidateOnlyPassed = await validateFcmKey(key);
  const uploaded = await gql(`mutation($input:GoogleServiceAccountKeyInput!,$accountId:ID!){googleServiceAccountKey{createGoogleServiceAccountKey(googleServiceAccountKeyInput:$input,accountId:$accountId){id projectIdentifier privateKeyIdentifier clientEmail}}}`, { input: { jsonKey: key }, accountId: before.ownerAccount.id });
  stored = uploaded.googleServiceAccountKey.createGoogleServiceAccountKey;
  await gql(`mutation($id:ID!,$keyId:ID!){androidAppCredentials{setGoogleServiceAccountKeyForFcmV1(id:$id,googleServiceAccountKeyId:$keyId){id}}}`, { id: record.id, keyId: stored.id });
}
const after = (await inspect()).app.byId;
const final = after.androidAppCredentials.find(c => c.id === record.id)?.googleServiceAccountKeyForFcmV1;
if (final?.id !== stored.id || final.projectIdentifier !== firebaseIdentity.projectId) throw new Error('FCM assignment verification failed');
const proof = { checkedAt: new Date().toISOString(), appId, packageName, firebaseProjectId: final.projectIdentifier, serviceAccount: final.clientEmail, googleKeyIdentifier: final.privateKeyIdentifier, fcmV1Configured: true, fcmValidateOnlyPassed, actualMessagesSent: 0 };
fs.mkdirSync('firebase-proof', { recursive: true });
fs.writeFileSync('firebase-proof/expo-firebase-configuration.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof));
