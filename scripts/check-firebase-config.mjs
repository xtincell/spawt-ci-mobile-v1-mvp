import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const firebaseIdentity = Object.freeze({
  projectId: 'spawt-ci',
  projectNumber: '784936275475',
  appId: '1:784936275475:android:3592fb2dc6cc9ffc0a39e6',
  packageName: 'com.upgraders.spawt',
});

export function validateFirebaseConfig(config) {
  const expected = firebaseIdentity;
  if (config?.private_key || config?.type === 'service_account') {
    throw new Error('Une clé de compte de service ne doit jamais être embarquée dans l’application');
  }
  if (config?.project_info?.project_id !== expected.projectId
    || String(config?.project_info?.project_number) !== expected.projectNumber) {
    throw new Error('Le projet Firebase Android ne correspond pas à SPAWT');
  }
  const client = config.client?.find(c => c.client_info?.android_client_info?.package_name === expected.packageName);
  if (!client || client.client_info.mobilesdk_app_id !== expected.appId
    || !client.api_key?.some(k => typeof k.current_key === 'string' && k.current_key.length > 0)) {
    throw new Error('Configuration Firebase incomplète pour le package Android SPAWT');
  }
  return expected;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.env.GOOGLE_SERVICES_JSON || fileURLToPath(new URL('../app/google-services.json', import.meta.url));
  if (!fs.existsSync(file)) throw new Error('Configuration Firebase Android absente : fournir GOOGLE_SERVICES_JSON');
  const identity = validateFirebaseConfig(JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log(JSON.stringify({ firebaseClientConfigVerified: true, ...identity }));
}
