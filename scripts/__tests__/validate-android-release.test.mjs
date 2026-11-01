import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { androidPublicationProfile, validateAndroidReleaseProof, BUILD42_RACCORDEMENTS, BUILD42_PROOF_SHA256 } from '../validate-android-release.mjs';

const received = JSON.parse(fs.readFileSync(new URL('../../documentation/android-build42-native-receipt.json', import.meta.url)));
const binary = JSON.parse(fs.readFileSync(new URL('../../documentation/android-build42-artifact.json', import.meta.url)));
const decision = 'owner-approved-build42-with-pending-receipts';

function candidate() {
  const recipe = { ...BUILD42_RACCORDEMENTS, publicationProfile: 'raccordements', publicationDecision: decision };
  const metadata = structuredClone(binary);
  const proof = {
    qaMetadata: structuredClone(binary), assertions: structuredClone(received.assertions.items),
    opening: structuredClone(received.openingVisibility), firebase: structuredClone(received.firebaseRuntime),
    upgrade: structuredClone(received.upgradeInstall), fingerprints: { ...BUILD42_PROOF_SHA256 },
    raccordements: {
      mode: 'raccordements', fullLiveReceipt: false, consoleModerationReceipt: false, physicalGuetReceipt: false,
      homeCatalogueRead: true, placeSearchRead: true, placeOpenedFromSearch: true,
      profileLegacyGoldCopyAbsent: true, profileSettingsLabelVisible: true, axesRequireVisualReview: true,
      profileVersoCapture: received.profile.versoCapture, profileSettingsCapture: received.profile.settingsCapture,
      outings: { ...received.outings, build: 42, sha256: recipe.sha256, apiOrigin: 'https://api.spawt.online', upgradeInstall: structuredClone(received.upgradeInstall) },
    },
  };
  return { recipe, metadata, proof };
}
const validate = ({ recipe, metadata, proof }) => validateAndroidReleaseProof(recipe, metadata, proof);

function complete() {
  const f = candidate();
  delete f.recipe.publicationProfile;
  delete f.recipe.publicationDecision;
  f.proof.outing = { ...f.proof.raccordements.outings, feedbackReceipt: true, sevenContentChecks: true, physicalGuetReceipt: true };
  f.proof.live = Object.fromEntries(['nativeAuthenticated', 'announcementsRead', 'editorialTextMatched', 'collectionRead', 'fiveContentChecksPassed', 'offlineFailureAndRecovery', 'feedbackReceiptReceived', 'feedbackReplyRead', 'personalExplorationChecked', 'unratedDocumentaryRead', 'nativeMenuPhotoReceivedAndModerated', 'contributionReceiptReceived', 'contributionModerationRead', 'contributionRewardRead', 'contributionDidNotCreateVisit'].map(key => [key, true]));
  Object.assign(f.proof.live, { build: 42, apiOrigin: 'https://api.spawt.online' });
  delete f.proof.raccordements;
  return f;
}

test('authorizes only the exact received build42 and both exact successful run references', () => {
  assert.equal(androidPublicationProfile(candidate().recipe), 'raccordements');
  for (const key of Object.keys(BUILD42_RACCORDEMENTS)) {
    const f = candidate();
    f.recipe[key] = typeof f.recipe[key] === 'number' ? f.recipe[key] + 1 : f.recipe[key] + 'changed';
    assert.throws(() => validate(f), /pinned/, key);
  }
  const f = candidate();
  delete f.recipe.publicationDecision;
  assert.throws(() => validate(f), /decision missing/);
  f.recipe.publicationProfile = 'skip';
  assert.throws(() => validate(f), /Unknown/);
});

test('publishes an honest qualification and only files present in the R2 candidate artifact', () => {
  const f = candidate();
  f.proof.raccordements.outings.listId = 'PRIVATE-TEST-ID';
  f.proof.raccordements.outings.listTitle = 'PRIVATE-TEST-TITLE';
  const result = validate(f);
  assert.equal(result.qualification.qualification, 'candidate');
  assert.equal(result.qualification.assertionsPassed, 31);
  for (const key of ['fullLiveReceipt', 'consoleModerationReceipt', 'physicalGuetReceipt']) assert.equal(result.qualification[key], false);
  assert.equal(JSON.stringify(result).includes('PRIVATE-TEST'), false);
  const sources = result.copies.map(([source]) => source);
  assert.ok(sources.includes('assertions.json'));
  assert.ok(sources.includes('raccordements-profile-scroll-2.png'));
  for (const absent of ['live-data.json', 'outing-data.json', 'raccordements-data.json', 'live-menu-contribution-rejected.png']) assert.ok(!sources.includes(absent));
});

test('rejects a substituted receipt, missing fingerprint, fewer assertions or failed assertion', () => {
  for (const mutate of [
    f => { f.proof.fingerprints['raccordements-data.json'] = '0'.repeat(64); },
    f => { delete f.proof.fingerprints['raccordements-profile-scroll-2.png']; },
    f => { f.proof.assertions.pop(); },
    f => { f.proof.assertions[0].passed = false; },
    f => { f.proof.assertions[1] = f.proof.assertions[0]; },
  ]) {
    const f = candidate(); mutate(f); assert.throws(() => validate(f));
  }
});

test('rejects invented, omitted or mixed full receipts in the candidate profile', () => {
  for (const key of ['fullLiveReceipt', 'consoleModerationReceipt', 'physicalGuetReceipt']) {
    for (const value of [true, undefined]) {
      const f = candidate(); f.proof.raccordements[key] = value;
      assert.throws(() => validate(f), /explicitly unverified/);
    }
  }
  const f = candidate(); f.proof.raccordements.outings.physicalGuetReceipt = true;
  assert.throws(() => validate(f), /explicitly unverified/);
  f.proof.raccordements.outings.physicalGuetReceipt = false; f.proof.live = {};
  assert.throws(() => validate(f), /explicitly unverified/);
});

test('retains binary, signature, Firebase, native opening and upgrade validation', () => {
  for (const mutate of [
    f => { f.metadata.sourceCommit = '0'.repeat(40); },
    f => { f.metadata.sha256 = '0'.repeat(64); },
    f => { f.proof.qaMetadata.sha256 = '0'.repeat(64); },
    f => { f.metadata.bytes++; },
    f => { f.metadata.signatureMatchesBuild25 = false; },
    f => { f.metadata.compiledBackendConfigVerified = false; },
    f => { f.metadata.compiledFirebaseConfigVerified = false; },
    f => { f.proof.firebase.defaultAppInitialized = false; },
    f => { f.proof.opening.passed = false; },
    f => { f.proof.upgrade.from = 40; },
    f => { f.proof.upgrade.installedOverPrevious = false; },
    f => { f.proof.raccordements.outings.crossAccountIsolation = false; },
    f => { f.proof.raccordements.profileSettingsLabelVisible = false; },
  ]) { const f = candidate(); mutate(f); assert.throws(() => validate(f)); }
});

test('the default complete profile retains live, moderation and physical Guet requirements', () => {
  const accepted = validate(complete());
  assert.equal(accepted.profile, 'complete');
  assert.equal(accepted.qualification, undefined);
  assert.ok(accepted.copies.some(([name]) => name === 'live-data.json'));
  for (const mutate of [
    f => { delete f.proof.live; },
    f => { f.proof.live.feedbackReplyRead = false; },
    f => { f.proof.live.contributionRewardRead = false; },
    f => { f.proof.outing.feedbackReceipt = false; },
    f => { f.proof.outing.sevenContentChecks = false; },
    f => { f.proof.outing.physicalGuetReceipt = false; },
  ]) { const f = complete(); mutate(f); assert.throws(() => validate(f)); }
  const partial = candidate(); delete partial.recipe.publicationProfile;
  assert.throws(() => validate(partial), /outing/);
});
