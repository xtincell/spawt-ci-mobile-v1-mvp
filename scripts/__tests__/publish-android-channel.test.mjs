import test from 'node:test';
import assert from 'node:assert/strict';
import { createAndroidChannel, shouldAdvanceAndroidChannel, androidRepository } from '../publish-android-channel.mjs';
function fixtures() {
  const recipe = { version: '1.1.1', build: 35, buildDate: '2026-10-18', tag: 'local-build-android-2026-10-18-35', sha256: 'a'.repeat(64), sourceCommit: 'b'.repeat(40), bytes: 160000000, buildRun: 1, qaRun: 2 };
  const metadata = { ...recipe, runId: 1, signatureMatchesBuild25: true, zipCrcPassed: true, nativePackageVerified: true, compiledBackendConfigVerified: true, compiledFirebaseConfigVerified: true };
  const release = { draft: false, tag_name: recipe.tag, published_at: '2026-10-18T17:00:00Z', assets: [{ name: 'spawt-1.1.1-build35.apk', state: 'uploaded', size: recipe.bytes, digest: `sha256:${recipe.sha256}`, browser_download_url: `https://github.com/${androidRepository}/releases/download/${recipe.tag}/spawt-1.1.1-build35.apk` }] };
  return { recipe, metadata, release };
}
test('advertises only the published bytes that passed native verification', () => {
  const { recipe, metadata, release } = fixtures();
  assert.equal(createAndroidChannel(recipe, metadata, release).build, 35);
  assert.throws(() => createAndroidChannel(recipe, { ...metadata, compiledFirebaseConfigVerified: false }, release), /verified binary/);
  assert.throws(() => createAndroidChannel(recipe, metadata, { ...release, draft: true }), /not published/);
  release.assets[0].digest = 'sha256:' + 'c'.repeat(64);
  assert.throws(() => createAndroidChannel(recipe, metadata, release), /digest differs/);
});
test('refuses a publication outside the expected repository', () => {
  const { recipe, metadata, release } = fixtures();
  release.assets[0].browser_download_url = 'https://example.com/app.apk';
  assert.throws(() => createAndroidChannel(recipe, metadata, release), /origin/);
});
test('does not downgrade or silently replace an existing build', () => {
  const { recipe, metadata, release } = fixtures();
  const next = createAndroidChannel(recipe, metadata, release);
  assert.equal(shouldAdvanceAndroidChannel({ ...next, build: 34 }, next), true);
  assert.equal(shouldAdvanceAndroidChannel(next, next), false);
  assert.throws(() => shouldAdvanceAndroidChannel({ ...next, build: 36 }, next), /downgrade/);
  assert.throws(() => shouldAdvanceAndroidChannel({ ...next, sha256: 'c'.repeat(64) }, next), /identity changed/);
});
