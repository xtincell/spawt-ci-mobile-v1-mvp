import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// The owner authorized this already-received candidate for the official alpha
// channel on 2026-10-31, with the three missing receipts disclosed. This is an
// explicit qualification of one binary, not a replacement for the full recipe.
export const BUILD42_RACCORDEMENTS = Object.freeze({
  version: '1.1.1', build: 42, buildDate: '2026-10-30',
  tag: 'local-build-android-2026-10-30-42',
  sourceCommit: '8cf7ea89ef7610b69c28f7608218f4e005dbdc30',
  sha256: '2fba5164863e446c8a4087c48954e67a790073865c9cd94c31a3a9a9003160f7',
  bytes: 162537663,
  buildRun: 41117097867,
  buildWorkflowCommit: '360d181c9c15c6378b06ec41893afeb6a653f120',
  qaRun: 41123847019,
  qaWorkflowCommit: '80672cc4b2b2ba5457ef40ee2151df3e3a074abf',
});

// Fingerprints of the received android-proof R2 artifact, already recorded in
// documentation/android-build42-native-receipt.json. No receipt is synthesized.
export const BUILD42_PROOF_SHA256 = Object.freeze({
  'apk-metadata.json': 'e1e35f72578244bdc54e847f45a7682e7aed0fa06ee8805f1500b2b9666a4344',
  'assertions.json': '0405c978f589bee21d1b13beb2e9b247cde5f723e95c9c820637126da8c379c3',
  'raccordements-data.json': 'dc6b15a6cd8cc79fb4d95af3bae6cc0df21dafc04f3ce2518bec7320ea6ea642',
  'upgrade-install.json': '619a5b16de2c259ab6494bd0739218cc80eb2a109dd189ad86aaf7c76575f869',
  'firebase-runtime.json': '20b42ead0992422d5f84a798d76cfc6a5821a5ea1e9c1ac7f49e2baf726feb36',
  'opening-visibility.json': 'c22f93b5eb4fefabcadb1197f2646df981fc459476ab8af378df02148abc9a5e',
  'raccordements-profile-verso.png': '282405f7eaa1fe9185b27eb6fda286aceda365a243cacc91f345f2b725a6a20f',
  'raccordements-profile-scroll-2.png': '38598f81b837168b976f44b1be1cadd0029a50f7ffbdf5de710092023cb14200',
});

const binaryChecks = ['signatureMatchesBuild25', 'zipCrcPassed', 'nativePackageVerified', 'compiledBackendConfigVerified', 'compiledFirebaseConfigVerified'];
const outingChecks = ['menuRead', 'dishSearch', 'saveReceipt', 'namedListRead', 'shareReadInBrowser', 'revokedLinkRefused', 'chooseReceipt', 'appLinkOpened', 'offlineSaveResumed', 'crossAccountIsolation'];
const liveChecks = ['nativeAuthenticated', 'announcementsRead', 'editorialTextMatched', 'collectionRead', 'fiveContentChecksPassed', 'offlineFailureAndRecovery', 'feedbackReceiptReceived', 'feedbackReplyRead', 'personalExplorationChecked', 'unratedDocumentaryRead'];
const contributionChecks = ['nativeMenuPhotoReceivedAndModerated', 'contributionReceiptReceived', 'contributionModerationRead', 'contributionRewardRead', 'contributionDidNotCreateVisit'];
const profileChecks = ['homeCatalogueRead', 'placeSearchRead', 'placeOpenedFromSearch', 'profileLegacyGoldCopyAbsent', 'profileSettingsLabelVisible'];
const missingReceipts = ['fullLiveReceipt', 'consoleModerationReceipt', 'physicalGuetReceipt'];
const requireTrue = (record, keys) => record && keys.every(key => record[key] === true);

export function androidPublicationProfile(recipe) {
  const profile = recipe.publicationProfile ?? 'complete';
  if (!['complete', 'raccordements'].includes(profile)) throw new Error('Unknown Android publication profile');
  if (profile === 'raccordements') {
    if (!Object.entries(BUILD42_RACCORDEMENTS).every(([key, value]) => recipe[key] === value)) throw new Error('Raccordements publication is pinned to the received build 42');
    if (recipe.publicationDecision !== 'owner-approved-build42-with-pending-receipts') throw new Error('Explicit build 42 publication decision missing');
  }
  return profile;
}

export function validateAndroidReleaseProof(recipe, metadata, proof) {
  const profile = androidPublicationProfile(recipe);
  const { qaMetadata, assertions, opening, firebase, upgrade, live, raccordements, fingerprints = {} } = proof;
  if (metadata.sourceCommit !== recipe.sourceCommit || metadata.version !== recipe.version || metadata.build !== recipe.build
    || metadata.runId !== recipe.buildRun || metadata.sha256 !== recipe.sha256 || metadata.bytes !== recipe.bytes
    || qaMetadata?.sha256 !== metadata.sha256 || !Array.isArray(assertions) || assertions.length < 5
    || !assertions.every(item => item.passed === true) || opening?.passed !== true) throw new Error('Release proof mismatch');
  if (!requireTrue(metadata, binaryChecks)) throw new Error('APK checks incomplete');
  if (firebase?.defaultAppInitialized !== true) throw new Error('Firebase native initialization was not verified');
  if (recipe.build >= 41 && (upgrade?.from !== recipe.build - 1 || upgrade?.to !== recipe.build
    || upgrade?.installedOverPrevious !== true || upgrade?.backgroundLocationDeclared !== true)) throw new Error('Native upgrade receipt missing');

  // R2 stores its real outing receipt inside raccordements-data.json. There is
  // deliberately no outing-data.json or live-data.json in that artifact.
  const outing = profile === 'raccordements' ? raccordements?.outings : proof.outing;
  if (recipe.build >= 41 && (outing?.build !== recipe.build || outing?.sha256 !== metadata.sha256
    || outing?.apiOrigin !== 'https://api.spawt.online' || !requireTrue(outing, outingChecks))) throw new Error('Native outing/list/web proof missing');
  if (recipe.build >= 41 && typeof outing.guetEnabled !== 'boolean') throw new Error('Guet gate status missing');

  if (profile === 'raccordements') {
    if (!Object.entries(BUILD42_PROOF_SHA256).every(([name, digest]) => fingerprints[name] === digest)) throw new Error('Received build 42 proof fingerprints differ');
    if (assertions.length !== 31 || new Set(assertions.map(item => item.check)).size !== 31) throw new Error('Build 42 requires its 31 received assertions');
    if (raccordements?.mode !== 'raccordements' || !requireTrue(raccordements, profileChecks)
      || raccordements.axesRequireVisualReview !== true
      || raccordements.profileVersoCapture !== 'raccordements-profile-verso.png'
      || raccordements.profileSettingsCapture !== 'raccordements-profile-scroll-2.png') throw new Error('Build 42 raccordements receipt incomplete');
    if (!missingReceipts.every(key => raccordements[key] === false) || outing.physicalGuetReceipt !== false
      || live !== undefined) throw new Error('Pending receipts must remain explicitly unverified');
    if (outing.guetEnabled !== true || !requireTrue(outing.upgradeInstall, ['installedOverPrevious', 'backgroundLocationDeclared'])
      || outing.upgradeInstall.from !== 41 || outing.upgradeInstall.to !== 42) throw new Error('Build 42 outing context differs');

    return {
      profile,
      copies: [
        ['assertions.json', 'native-assertions.json'],
        ['upgrade-install.json', 'upgrade-install-proof.json'],
        ['firebase-runtime.json', 'firebase-runtime-proof.json'],
        ['opening-visibility.json', 'opening-visibility-proof.json'],
        ['raccordements-profile-verso.png', 'raccordements-profile-verso.png'],
        ['raccordements-profile-scroll-2.png', 'raccordements-profile-scroll-2.png'],
      ],
      qualification: {
        schemaVersion: 1, publicationProfile: profile, qualification: 'candidate',
        publicationDecision: recipe.publicationDecision,
        version: recipe.version, build: recipe.build, sourceCommit: recipe.sourceCommit,
        sha256: recipe.sha256, bytes: recipe.bytes,
        buildRun: recipe.buildRun, qaRun: recipe.qaRun, nativeReceiptRevision: 2,
        assertionsPassed: 31, assertionsFailed: 0,
        upgradeInstall: { from: upgrade.from, to: upgrade.to, installedOverPrevious: true, backgroundLocationDeclared: true },
        firebaseInitialized: true, openingVisibilityPassed: true,
        outingChecks: Object.fromEntries(outingChecks.map(key => [key, outing[key]])),
        profileChecks: Object.fromEntries(profileChecks.map(key => [key, raccordements[key]])),
        fullLiveReceipt: false, consoleModerationReceipt: false, physicalGuetReceipt: false,
        sourceProofSha256: { ...BUILD42_PROOF_SHA256 },
        scope: 'Received native raccordements recipe. Full live/console reception and physical Guet reception remain open.',
      },
    };
  }

  // The complete recipe remains the default for every other publication.
  const copies = [];
  if (recipe.build >= 41) {
    if (!requireTrue(outing, ['feedbackReceipt', 'sevenContentChecks'])) throw new Error('Live native outing/list/web proof missing');
    if (outing.guetEnabled === true && outing.physicalGuetReceipt !== true) throw new Error('Physical Guet receipt required before activation');
    copies.push(['outing-data.json', 'outing-data-proof.json']);
    for (const name of ['outing-native-menu', 'outing-dish-search', 'outing-named-list', 'outing-public-browser', 'outing-app-link', 'outing-revoked-browser']) copies.push([`${name}.png`, `${name}.png`]);
  }
  if (recipe.build >= 37) {
    if (live?.build !== recipe.build || live?.apiOrigin !== 'https://api.spawt.online' || !requireTrue(live, liveChecks)) throw new Error('Live native database and feedback proof missing');
    if (recipe.build >= 39 && !requireTrue(live, contributionChecks)) throw new Error('Native contribution and moderation proof missing');
    copies.push(['live-data.json', 'live-data-proof.json'], ['live-home-393-1.png', 'home-native.png'], ['live-content-checks.png', 'content-checks-native.png']);
    if (recipe.build >= 39) for (const [source, target] of [['live-menu-contribution-rejected.png', 'menu-moderation-native.png'], ['live-contribution-reward.png', 'contribution-reward-native.png'], ['live-contribution-paws-ledger.png', 'paws-ledger-native.png']]) copies.push([source, target]);
  }
  return { profile, copies };
}

export function prepareAndroidReleaseProof(recipe, { artifactDirectory = 'release-apk', proofDirectory = 'native-proof' } = {}) {
  const profile = androidPublicationProfile(recipe);
  const read = name => JSON.parse(fs.readFileSync(path.join(proofDirectory, name), 'utf8'));
  const metadata = JSON.parse(fs.readFileSync(path.join(artifactDirectory, 'apk-metadata.json'), 'utf8'));
  const proof = { qaMetadata: read('apk-metadata.json'), assertions: read('assertions.json'), opening: read('opening-visibility.json'), firebase: read('firebase-runtime.json') };
  if (recipe.build >= 41) proof.upgrade = read('upgrade-install.json');
  if (profile === 'raccordements') {
    proof.raccordements = read('raccordements-data.json');
    if (fs.existsSync(path.join(proofDirectory, 'live-data.json'))) throw new Error('Pending receipts must remain explicitly unverified');
    proof.fingerprints = Object.fromEntries(Object.keys(BUILD42_PROOF_SHA256).map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(proofDirectory, name))).digest('hex')]));
  } else {
    if (recipe.build >= 41) proof.outing = read('outing-data.json');
    if (recipe.build >= 37) proof.live = read('live-data.json');
  }
  const result = validateAndroidReleaseProof(recipe, metadata, proof);
  const assets = result.copies.map(([source, target]) => {
    const destination = path.join(artifactDirectory, target);
    fs.copyFileSync(path.join(proofDirectory, source), destination);
    return destination;
  });
  if (result.qualification) {
    const destination = path.join(artifactDirectory, 'release-qualification.json');
    fs.writeFileSync(destination, JSON.stringify(result.qualification, null, 2) + '\n');
    assets.push(destination);
  }
  return { metadata, profile, assets, qualification: result.qualification };
}
