import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const dish48Files = Object.freeze([
  'dish-rating-48.json', 'note-du-plat.png', 'envies-lieu-premier.png', 'envies-favoris-plats.png',
]);

const readAttestation = () => JSON.parse(
  readFileSync(new URL('../documentation/android-build48-alpha-receipt.json', import.meta.url), 'utf8'),
);

export function requireDish48Recipe(recipe, attestation = readAttestation()) {
  assert.equal(recipe.publicationProfile, 'dish48-alpha');
  assert.equal(recipe.publicationDecision, 'owner-approved-build48-alpha-with-pending-receipts');
  assert.equal(recipe.version, '1.1.7');
  assert.equal(recipe.build, 48);
  assert.match(recipe.buildDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(recipe.tag, `local-build-android-${recipe.buildDate}-48`);
  for (const key of ['bytes', 'buildRun', 'qaRun']) {
    assert.ok(Number.isSafeInteger(recipe[key]) && recipe[key] > 0, key);
  }
  for (const key of ['sourceCommit', 'buildWorkflowCommit', 'qaWorkflowCommit']) {
    assert.match(recipe[key], /^[a-f0-9]{40}$/, key);
  }
  assert.match(recipe.sha256, /^[a-f0-9]{64}$/);
  for (const key of ['version', 'build', 'buildDate', 'tag', 'sourceCommit', 'sha256', 'bytes',
    'buildRun', 'buildWorkflowCommit', 'qaRun', 'qaWorkflowCommit']) {
    assert.equal(recipe[key], attestation[key], key);
  }
  assert.deepEqual(Object.keys(attestation.receiptFiles).sort(), [...dish48Files].sort());
  for (const name of dish48Files) assert.match(attestation.receiptFiles[name], /^[a-f0-9]{64}$/, name);
}

export function readDish48Receipt(recipe, proofDirectory, attestation = readAttestation()) {
  requireDish48Recipe(recipe, attestation);
  for (const name of dish48Files) {
    const file = readFileSync(path.join(proofDirectory, name));
    assert.equal(createHash('sha256').update(file).digest('hex'), attestation.receiptFiles[name], name);
  }
  return JSON.parse(readFileSync(path.join(proofDirectory, dish48Files[0]), 'utf8'));
}

export function receiveDish48(recipe, proof) {
  assert.equal(proof.build, 48);
  assert.equal(proof.sha256, recipe.sha256);
  assert.equal(proof.source, recipe.sourceCommit);
  assert.equal(proof.api, 'https://api.spawt.online');
  const upgrade = proof.upgradeFavorite;
  assert.equal(upgrade.from, 47);
  assert.equal(upgrade.to, 48);
  assert.equal(upgrade.previousSha256, '88042ac19e7c6d3af6626f761f25eab45bbe3d212651af05f0a8ab1e66214129');
  for (const key of ['previousFavoriteSaved', 'updateOverPrevious', 'firstInstallTimePreserved',
    'sessionRestoredWithoutOtp', 'favoriteReadAfterUpgrade', 'removedFromUpdatedApp']) {
    assert.equal(upgrade[key], true, key);
  }
  assert.deepEqual(proof.saved_sections, ['Lieux enregistrés','Favoris plats']);
  const states = [
    ['editor_optional',false,false,null], ['draft_only',false,false,null],
    ['rated_without_saves',false,false,4], ['rating_changed',false,false,2], ['rating_removed',false,false,null],
    ['only_dish',false,true,null], ['place_and_dish',true,true,null], ['only_place',true,false,null],
    ['neither',false,false,null], ['original_state_restored',false,false,null],
  ];
  assert.deepEqual(proof.checks.map(s => [s.name,s.place,s.dish,s.rating]),states);
  let previous = -Infinity;
  for (const {at} of proof.checks) {
    const ts=Date.parse(at);
    assert.ok(Number.isFinite(ts) && ts >= previous);
    previous=ts;
  }
  return { independentFavoriteTypes: true, optionalDishRating: true, draftNotPersisted: true,
    ratingChangeAndDeletionVerified: true, originalSyntheticAccountStateRestored: true,
    previousPublicBuild: upgrade.from, previousPublicSha256: upgrade.previousSha256,
    sessionRestoredWithoutOtp: true, previousFavoritePreservedAndRemoved: true,
    firstInstallTimePreserved: true, observedStates: proof.checks.length, api:proof.api };
}
