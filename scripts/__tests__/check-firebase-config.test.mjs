import assert from 'node:assert/strict';
import test from 'node:test';
import { firebaseIdentity as expected, validateFirebaseConfig } from '../check-firebase-config.mjs';

function validConfig() {
  return {
    project_info: { project_id: expected.projectId, project_number: expected.projectNumber },
    client: [{ client_info: { mobilesdk_app_id: expected.appId, android_client_info: { package_name: expected.packageName } }, api_key: [{ current_key: 'client-config-fixture' }] }],
  };
}
test('accepts the Firebase client matching the distributed Android app', () => {
  assert.deepEqual(validateFirebaseConfig(validConfig()), expected);
});
test('rejects a client from another project or package before compilation', () => {
  const otherProject = validConfig(); otherProject.project_info.project_id = 'another-project';
  assert.throws(() => validateFirebaseConfig(otherProject), /projet Firebase/);
  const otherPackage = validConfig(); otherPackage.client[0].client_info.android_client_info.package_name = 'another.package';
  assert.throws(() => validateFirebaseConfig(otherPackage), /package Android/);
  const otherApp = validConfig(); otherApp.client[0].client_info.mobilesdk_app_id = 'another-app';
  assert.throws(() => validateFirebaseConfig(otherApp), /package Android/);
});
test('rejects an Admin SDK private key and missing client credentials', () => {
  assert.throws(() => validateFirebaseConfig({ type: 'service_account', private_key: 'fixture' }), /jamais être embarquée/);
  const noKey = validConfig(); noKey.client[0].api_key = [];
  assert.throws(() => validateFirebaseConfig(noKey), /incomplète/);
});
