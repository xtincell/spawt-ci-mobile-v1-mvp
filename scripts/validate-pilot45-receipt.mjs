import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// This incomplete run is deliberately recorded with its actual failed conclusion.
// These hashes bind the alpha qualification to individual original receipts.
export function receivePilot45Alpha(directory) {
  const hashes = {
    'le-cha/recu-navigation.json': 'ced7082c4f0ef57a0bde036abfa26763c5493a313a7fc5588509aa4d01ee49ed',
    'carte-processus.json': '173014987240b5ad3e29e208cd25386b062de576e1b17c627bda9674fe445933',
    'signed-upgrade.txt': '7a78a5b743d4fdb231eccbdec137a4dd99bb3af79f2e9cfecd3c31f116bca750',
    'verified-links.txt': '37c437d21c72eb35ab865a1f5cb54f5ee50326ccaf97894578604c48d94eb9d1',
  };
  for (const [name, digest] of Object.entries(hashes)) {
    if (createHash('sha256').update(readFileSync(path.join(directory, name))).digest('hex') !== digest) {
      throw new Error('Original alpha receipt fingerprint differs: ' + name);
    }
  }
  const read = name => JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
  const review = read('le-cha/recu-navigation.json');
  const cold = review.checks.find(c => c.state === 'cold');
  const map = read('carte-processus.json');
  if (!cold?.process_verified || !cold.quote || !cold.photo || cold.title !== 'Le Cha'
    || !['Cuisine 5/5', 'Cadre 4/5', 'Service 3/5'].every(note => cold.ratings.includes(note))) throw new Error('Cold review opening incomplete');
  if (map.same_process !== true || map.remount_same_process !== true || map.crash_buffer !== false || map.controls !== true) throw new Error('Received native map failed');
  const upgrade = readFileSync(path.join(directory, 'signed-upgrade.txt'), 'utf8');
  const installs = [...upgrade.matchAll(/firstInstallTime=([^\r\n]+)/g)].map(m => m[1]);
  if (installs.length !== 2 || installs[0] !== installs[1] || !upgrade.includes('versionCode=42 ') || !upgrade.includes('versionCode=45 ')) throw new Error('Signed public upgrade not established');
  return {
    precedingPilotRun: 45710839404, precedingPilotConclusion: 'failure',
    androidVersion: review.os, browser: review.browser, browserVersion: review.browser_version,
    signedUpgradeFromPublic42: true, domainVerified: true, deepLinkColdReviewRead: true,
    nativeMapAndListReceivedInEmulation: true, nativeMapKnownCoordinates: map.markers,
    initialPlainHttpsBrowserWarmConfirmed: false,
  };
}

// The Play Store emulator and the isolated synthetic API exercise the same client source.
// The private receipts are read in CI; only the aggregate checks enter the public release.
export function receivePilot45(directory) {
  const read = name => JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
  const domain = readFileSync(path.join(directory, 'verified-links.txt'), 'utf8');
  if (!/^\s*spawt\.online:\s+verified\s*$/m.test(domain)) throw new Error('Unverified Android app-link domain');
  const review = read('le-cha/recu-navigation.json');
  const place = 'c5acfd12-01dd-5cd3-9beb-0531d89c3e99';
  if (review.build !== 45 || review.url !== 'https://spawt.online/ouvrir/avis/le-cha-alexandre' ||
      !review.browser || !review.browser_version || !Array.isArray(review.checks) || !['cold','warm'].every(state => review.checks.some(
        c => c.state === state && c.process_verified && c.title === 'Le Cha' && c.quote && c.photo &&
          ['Cuisine 5/5','Cadre 4/5','Service 3/5'].every(note => c.ratings.includes(note))))) {
    throw new Error('Le Cha browser receipt incomplete');
  }
  const journeys = new Set();
  for (const source of ['facebook','instagram']) {
    const receipt = read(source+'.json');
    const server = receipt.server;
    if (receipt.build !== 45 || !receipt.journey || journeys.has(receipt.journey) || receipt.journey !== server?.journey || server?.source !== source ||
        server?.population !== 'interne' || server?.acquisition !== true) throw new Error('Missing synthetic campaign handoff');
    journeys.add(receipt.journey);
    const actions = server.actions;
    const view = actions.find(a => a.applied && a.place === place && a.event === 'place_viewed');
    const saved = actions.find(a => a.applied && a.place === place && a.event === 'saved_place_added');
    if (!view || !saved || !(Date.parse(view.at_utc) < Date.parse(saved.at_utc)) || !Number.isFinite(Date.parse(saved.ack_utc))) {
      throw new Error('Missing durable view and favorite receipt');
    }
  }
  const upgrade = read('favori-mise-a-jour.json');
  const map = read('carte-processus.json');
  if (upgrade.from !== 42 || upgrade.to !== 45 || !upgrade.legacy_server_ack ||
      !upgrade.after_upgrade_favorite_visible || upgrade.server?.acquisition !== false) {
    throw new Error('Prior favorite or reopen receipt missing');
  }
  if (!map.same_process || !map.remount_same_process || map.crash_buffer !== false || !map.controls) {
    throw new Error('Map lifecycle receipt missing');
  }
  return { browser: review.browser, browserVersion: review.browser_version, reviewOpenedColdAndWarm: true,
    nativeMapAndListReceived: true, syntheticHandoffsReceived: ['facebook','instagram'],
    previousFavoritePreserved: true, alreadyInstalledCountedAsReopen: true };
}
