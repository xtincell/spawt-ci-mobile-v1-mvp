import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { androidPublicationProfile } from '../validate-android-release.mjs';
import { dish48Files, receiveDish48, requireDish48Recipe } from '../validate-dish48-receipt.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const recipe = {
  version: '1.1.7', build: 48, buildDate: '2026-11-26', tag: 'local-build-android-2026-11-26-48',
  sourceCommit: '1'.repeat(40), sha256: sha('test apk'), bytes: 8,
  buildRun: 100, buildWorkflowCommit: '2'.repeat(40), qaRun: 101, qaWorkflowCommit: '3'.repeat(40),
  publicationProfile: 'dish48-alpha', publicationDecision: 'owner-approved-build48-alpha-with-pending-receipts',
};
const upgradeFavorite = {
  from: 47, to: 48, previousSha256: '88042ac19e7c6d3af6626f761f25eab45bbe3d212651af05f0a8ab1e66214129',
  previousFavoriteSaved: true, updateOverPrevious: true, firstInstallTimePreserved: true,
  sessionRestoredWithoutOtp: true, favoriteReadAfterUpgrade: true, removedFromUpdatedApp: true,
};
const checks = [
  ['editor_optional', false, false, null], ['draft_only', false, false, null], ['rated_without_saves', false, false, 4],
  ['rating_changed', false, false, 2], ['rating_removed', false, false, null], ['only_dish', false, true, null],
  ['place_and_dish', true, true, null], ['only_place', true, false, null], ['neither', false, false, null],
  ['original_state_restored', false, false, null],
].map(([name, place, dish, rating], i) => ({ name, place, dish, rating, at: new Date(i * 1000).toISOString() }));
const proof = {
  build: 48, sha256: recipe.sha256, source: recipe.sourceCommit, api: 'https://api.spawt.online',
  upgradeFavorite, saved_sections: ['Lieux enregistrés', 'Favoris plats'], checks,
};
const files = Object.fromEntries(dish48Files.map(name => [name, name.endsWith('.json') ? JSON.stringify(proof) : 'test ' + name]));
const attestation = { ...recipe, receiptFiles: Object.fromEntries(Object.entries(files).map(([name, body]) => [name, sha(body)])) };

test('the alpha decision binds both runs, the signed APK and all four received files', () => {
  requireDish48Recipe(recipe, attestation);
  for (const key of Object.keys(recipe)) assert.throws(() => requireDish48Recipe({ ...recipe, [key]: undefined }, attestation), undefined, key);
  for (const key of ['sourceCommit', 'buildWorkflowCommit', 'qaWorkflowCommit', 'sha256', 'qaRun', 'buildRun', 'bytes']) {
    assert.throws(() => requireDish48Recipe(recipe, { ...attestation, [key]: 'other' }), undefined, key);
  }
  for (const name of dish48Files) {
    const partial = structuredClone(attestation);
    delete partial.receiptFiles[name];
    assert.throws(() => requireDish48Recipe(recipe, partial), name);
  }
  assert.throws(() => requireDish48Recipe(recipe, { ...attestation, receiptFiles: {} }));
  assert.throws(() => androidPublicationProfile({ ...recipe, publicationProfile: undefined }));
});

test('the original session and the favorite from the public 47 must survive the signed update', () => {
  assert.equal(receiveDish48(recipe, proof).previousFavoritePreservedAndRemoved, true);
  for (const key of Object.keys(upgradeFavorite)) {
    assert.throws(() => receiveDish48(recipe, { ...proof, upgradeFavorite: { ...upgradeFavorite, [key]: false } }), key);
  }
  assert.throws(() => receiveDish48(recipe, { ...proof, upgradeFavorite: {} }));
});

test('the authenticated dish, place and rating choices are independent and restored', () => {
  for (const key of ['api', 'source', 'sha256', 'build', 'saved_sections']) {
    assert.throws(() => receiveDish48(recipe, { ...proof, [key]: null }), key);
  }
  for (const step of checks) {
    const broken = checks.map(item => item === step ? { ...item, place: !item.place } : item);
    assert.throws(() => receiveDish48(recipe, { ...proof, checks: broken }), step.name);
  }
  assert.throws(() => receiveDish48(recipe, { ...proof, checks: checks.slice(0, -1) }));
  assert.throws(() => receiveDish48(recipe, { ...proof, checks: checks.map((s, i) => i === 3 ? { ...s, at: checks[0].at } : s) }));
});

test('the real release entry point produces the qualified assets and refuses a substituted receipt', async t => {
  // Isolate synthetic test attestations from the actual shipping manifest.
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'spawt-release-test-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const artifactDirectory = path.join(fixture, 'apk');
  const proofDirectory = path.join(fixture, 'proof');
  for (const directory of [artifactDirectory, proofDirectory, path.join(fixture, 'scripts'), path.join(fixture, 'documentation')]) mkdirSync(directory);
  for (const file of ['validate-android-release.mjs', 'validate-dish48-receipt.mjs', 'validate-pilot47-receipt.mjs',
    'validate-ui46-receipt.mjs', 'validate-pilot45-receipt.mjs']) {
    copyFileSync(new URL('../' + file, import.meta.url), path.join(fixture, 'scripts', file));
  }
  const json = (dir, name, value) => writeFileSync(path.join(dir, name), JSON.stringify(value));
  json(path.join(fixture, 'documentation'), 'android-build48-alpha-receipt.json', attestation);
  const metadata = { ...recipe, runId: recipe.buildRun, signatureMatchesBuild25: true, zipCrcPassed: true,
    nativePackageVerified: true, compiledBackendConfigVerified: true, compiledFirebaseConfigVerified: true };
  json(artifactDirectory, 'apk-metadata.json', metadata);
  json(proofDirectory, 'apk-metadata.json', metadata);
  json(proofDirectory, 'firebase-runtime.json', { defaultAppInitialized: true });
  json(proofDirectory, 'opening-visibility.json', { passed: true });
  json(proofDirectory, 'assertions.json', Array.from({ length: 5 }, () => ({ passed: true })));
  json(proofDirectory, 'upgrade-install.json', { from: 47, to: 48, installedOverPrevious: true, backgroundLocationDeclared: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(proofDirectory, name), body);
  const { prepareAndroidReleaseProof } = await import(pathToFileURL(path.join(fixture, 'scripts', 'validate-android-release.mjs')));
  const prepare = () => prepareAndroidReleaseProof(recipe, { artifactDirectory, proofDirectory });
  const { assets, qualification } = prepare();
  assert.equal(qualification.rating.sessionRestoredWithoutOtp, true);
  assert.equal(qualification.fullLiveReceipt, false);
  assert.equal(qualification.physicalGuetReceipt, false);
  for (const [name, body] of Object.entries(files)) {
    assert.ok(assets.includes(path.join(artifactDirectory, name)));
    assert.equal(readFileSync(path.join(artifactDirectory, name), 'utf8'), body);
    writeFileSync(path.join(proofDirectory, name), 'substituted');
    assert.throws(prepare, new RegExp(name.replaceAll('.', '\\.')));
    writeFileSync(path.join(proofDirectory, name), body);
  }
  json(proofDirectory, 'upgrade-install.json', { from: 46, to: 48, installedOverPrevious: true, backgroundLocationDeclared: true });
  assert.throws(prepare, /Native upgrade receipt missing/);
});
