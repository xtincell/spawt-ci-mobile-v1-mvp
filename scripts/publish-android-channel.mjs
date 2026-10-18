import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const androidRepository = 'xtincell/spawt-ci-mobile-v1-mvp';
export function createAndroidChannel(recipe, metadata, release) {
  const name = `spawt-${recipe.version}-build${recipe.build}.apk`;
  if (!Number.isSafeInteger(recipe.build) || recipe.build < 35 || !/^\d+\.\d+\.\d+$/.test(recipe.version)
    || !/^[a-f0-9]{64}$/.test(recipe.sha256) || !/^[a-f0-9]{40}$/.test(recipe.sourceCommit)
    || recipe.tag !== `local-build-android-${recipe.buildDate}-${recipe.build}`) throw new Error('Invalid Android channel recipe');
  if (metadata.build !== recipe.build || metadata.version !== recipe.version || metadata.sha256 !== recipe.sha256
    || metadata.bytes !== recipe.bytes || metadata.sourceCommit !== recipe.sourceCommit || metadata.runId !== recipe.buildRun
    || !['signatureMatchesBuild25', 'zipCrcPassed', 'nativePackageVerified', 'compiledBackendConfigVerified', 'compiledFirebaseConfigVerified'].every(k => metadata[k] === true)) throw new Error('Android channel requires verified binary metadata');
  if (release.draft || release.tag_name !== recipe.tag || !release.published_at) throw new Error('Android release is not published');
  const files = release.assets.filter(a => a.name === name);
  if (files.length !== 1 || files[0].state !== 'uploaded' || files[0].size !== recipe.bytes || files[0].digest !== `sha256:${recipe.sha256}`) throw new Error('Published APK digest differs from the verified binary');
  const url = `https://github.com/${androidRepository}/releases/download/${recipe.tag}/${name}`;
  if (files[0].browser_download_url !== url) throw new Error('Unexpected Android download origin');
  return { schemaVersion: 1, packageName: 'com.upgraders.spawt', version: recipe.version, build: recipe.build, buildDate: recipe.buildDate,
    fileName: name, url, sha256: recipe.sha256, bytes: recipe.bytes, sourceCommit: recipe.sourceCommit, publishedAt: release.published_at,
    verification: { buildRun: recipe.buildRun, qaRun: recipe.qaRun } };
}

export function shouldAdvanceAndroidChannel(previous, next) {
  if (!Number.isSafeInteger(previous.build) || previous.packageName !== next.packageName) throw new Error('Existing Android channel is invalid');
  if (previous.build > next.build) throw new Error('Refusing to downgrade the public Android channel');
  if (previous.build === next.build) {
    if (previous.sha256 !== next.sha256 || previous.sourceCommit !== next.sourceCommit || previous.url !== next.url) throw new Error('Published Android build identity changed');
    return false;
  }
  return true;
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== androidRepository || !process.env.GH_TOKEN) throw new Error('Unexpected publication identity');
  const api = async (suffix, method = 'GET', body, allowMissing = false) => {
    const response = await fetch(`https://api.github.com/repos/${androidRepository}${suffix}`, { method,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GH_TOKEN}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`Android publication API HTTP ${response.status}`);
    return response.json();
  };
  const recipe = JSON.parse(fs.readFileSync('documentation/android-release.json', 'utf8'));
  const metadata = JSON.parse(fs.readFileSync('release-apk/apk-metadata.json', 'utf8'));
  const release = await api(`/releases/tags/${recipe.tag}`);
  const manifest = createAndroidChannel(recipe, metadata, release);
  const branch = 'android-releases';
  const content = Buffer.from(JSON.stringify(manifest, null, 2) + '\n').toString('base64');
  const existing = await api(`/contents/latest.json?ref=${branch}`, 'GET', undefined, true);
  if (existing) {
    const previous = JSON.parse(Buffer.from(existing.content, 'base64').toString('utf8'));
    if (shouldAdvanceAndroidChannel(previous, manifest)) await api('/contents/latest.json', 'PUT', { message: `release: Android build ${manifest.build}`, content, branch, sha: existing.sha });
  } else {
    if (await api(`/git/ref/heads/${branch}`, 'GET', undefined, true)) throw new Error('Android channel branch exists without its manifest');
    const blob = await api('/git/blobs', 'POST', { content, encoding: 'base64' });
    const tree = await api('/git/trees', 'POST', { tree: [{ path: 'latest.json', mode: '100644', type: 'blob', sha: blob.sha }] });
    const commit = await api('/git/commits', 'POST', { message: `release: Android build ${manifest.build}`, tree: tree.sha, parents: [] });
    await api('/git/refs', 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha });
  }
  const checked = await api(`/contents/latest.json?ref=${branch}`);
  const published = JSON.parse(Buffer.from(checked.content, 'base64').toString('utf8'));
  if (published.build !== manifest.build || published.sha256 !== manifest.sha256) throw new Error('Public Android channel verification failed');
  console.log(JSON.stringify({ publicAndroidChannelUpdated: true, build: manifest.build, sha256: manifest.sha256, url: manifest.url }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
