import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { requirePilot47Recipe, readPilot47Receipt } from './validate-pilot47-receipt.mjs';
import { dish48Files, readDish48Receipt, receiveDish48, requireDish48Recipe } from './validate-dish48-receipt.mjs';
import { loadUi46 } from './validate-ui46-receipt.mjs';
import { receivePilot45Alpha } from './validate-pilot45-receipt.mjs';

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
  if (recipe.build === 48 && profile !== 'dish48-alpha') throw new Error('Signed build 48 dish and upgrade receipts are required');
  if (!['complete', 'raccordements', 'pilot45-alpha', 'ui46-alpha', 'pilot47-signed', 'dish48-alpha'].includes(profile)) throw new Error('Unknown Android publication profile');
  if (profile === 'dish48-alpha') requireDish48Recipe(recipe);
  if (profile === 'pilot47-signed') requirePilot47Recipe(recipe);
  if (profile === 'ui46-alpha') {
    const pinned = JSON.parse(fs.readFileSync(new URL('../documentation/android-build46-alpha-receipt.json', import.meta.url), 'utf8'));
    const fields = ['version','build','buildDate','tag','sourceCommit','sha256','bytes','buildRun','buildWorkflowCommit','qaRun','qaWorkflowCommit','uiRun','uiWorkflowCommit'];
    if (recipe.build !== 46 || recipe.version !== '1.1.5' || recipe.publicationDecision !== 'owner-approved-build46-alpha-with-pending-receipts'
      || !fields.every(key => recipe[key] !== undefined && recipe[key] === pinned[key])) throw new Error('The UI alpha profile is pinned to the observed build 46');
  }
  if (profile === 'pilot45-alpha') {
    const attestation = JSON.parse(fs.readFileSync(new URL('../documentation/android-build45-team-guet.json', import.meta.url), 'utf8'));
    if (recipe.build !== 45 || recipe.sourceCommit !== 'c0381415c67722c41ee075b49358d65dcb35c466' || recipe.buildRun !== 45709291720
      || recipe.sha256 !== 'b6a092e3935835de1f6a0b6384c953d96b0f37ed15eaeb5ba842527a95e63a90'
      || recipe.publicationDecision !== 'owner-approved-build45-alpha-with-pending-receipts'
      || attestation.status !== 'received' || attestation.teamStatement !== 'Guet validé sur mobile'
      || !['version', 'build', 'buildDate', 'tag', 'sourceCommit', 'sha256', 'bytes', 'buildRun', 'buildWorkflowCommit', 'qaRun', 'qaWorkflowCommit', 'pilotRun', 'pilotWorkflowCommit', 'liveRun', 'liveWorkflowCommit']
        .every(key => recipe[key] !== undefined && recipe[key] === attestation[key])) {
      throw new Error('Team Guet attestation is pinned to the verified build 45 and its native receipts');
    }
  }
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

  if (profile === 'dish48-alpha') {
    const rating = receiveDish48(recipe, proof.dishRating);
    return { profile, copies: [
      ['assertions.json', 'native-opening-assertions.json'], ['upgrade-install.json', 'upgrade-install-proof.json'],
      ['firebase-runtime.json', 'firebase-runtime-proof.json'], ['opening-visibility.json', 'opening-visibility-proof.json'],
      ...dish48Files.map(name => [name, name]),
    ], qualification: {
      schemaVersion: 1, publicationProfile: profile, qualification: 'alpha', publicationDecision: recipe.publicationDecision,
      version: recipe.version, build: recipe.build, sourceCommit: recipe.sourceCommit, sha256: recipe.sha256, bytes: recipe.bytes,
      buildRun: recipe.buildRun, qaRun: recipe.qaRun, upgradeFrom47: true, firebaseInitialized: true,
      signedOpeningAssertionsPassed: assertions.length, rating,
      fullLiveReceipt: false, consoleModerationReceipt: false, physicalGuetReceipt: false,
    } };
  }

  if (profile === 'pilot47-signed') {
    if (proof.pilot47?.initialStateRestored !== true || proof.pilot47.sha256 !== recipe.sha256
      || proof.pilot47.source !== recipe.uiWorkflowCommit || proof.pilot47.favoriteReadAfterLauncherRestart !== true) throw new Error('Signed pilot 47 receipt missing');
    return { profile, copies: [
      ['assertions.json','native-opening-assertions.json'], ['upgrade-install.json','upgrade-install-proof.json'],
      ['firebase-runtime.json','firebase-runtime-proof.json'], ['opening-visibility.json','opening-visibility-proof.json'],
    ], qualification: {
      schemaVersion:1, qualification:'alpha', publicationProfile:profile, version:recipe.version, build:recipe.build,
      bytes:recipe.bytes, sha256:recipe.sha256, sourceCommit:recipe.sourceCommit, buildRun:recipe.buildRun, qaRun:recipe.qaRun,
      native:proof.pilot47, campaignAttributionVerified:false, completeOnboardingVerified:false, physicalGuetReceipt:false,
      fullLiveReceipt:false, consoleModerationReceipt:false,
    } };
  }

  if (profile === 'ui46-alpha') {
    if (proof.ui?.signedLeCha !== true || proof.ui?.mapPointAndNeighborhood !== true || proof.ui?.savedPlaceAndDish !== true) throw new Error('Signed or visual Android evidence missing');
    return { profile, copies: [
      ['assertions.json','native-opening-assertions.json'], ['upgrade-install.json','upgrade-install-proof.json'],
      ['firebase-runtime.json','firebase-runtime-proof.json'], ['opening-visibility.json','opening-visibility-proof.json'],
      ['le-cha-signed.json','le-cha-signed.json'], ['le-cha-cold.png','le-cha-native-46.png']
    ], qualification: {
      schemaVersion: 1, publicationProfile: profile, qualification: 'alpha', publicationDecision: recipe.publicationDecision,
      version: recipe.version, build: recipe.build, sourceCommit: recipe.sourceCommit, sha256: recipe.sha256, bytes: recipe.bytes,
      buildRun: recipe.buildRun, qaRun: recipe.qaRun, signedUpgradeFrom45: true, firebaseInitialized: true,
      signedOpeningAssertionsPassed: assertions.length, screens: proof.ui,
      fullLiveReceipt: false, consoleModerationReceipt: false, physicalGuetReceipt: false,
      scope: 'Alpha. Le support, la modération en production et le Guet sur appareil physique restent sans reçu pour le build 46.',
    } };
  }

  if (profile === 'pilot45-alpha') {
    if (!proof.pilot?.signedUpgradeFromPublic42 || !proof.pilot.domainVerified || !proof.pilot.deepLinkColdReviewRead
      || !proof.pilot.nativeMapAndListReceivedInEmulation || proof.partialLiveVerified !== true) throw new Error('Native pilot receipts missing');
    if (proof.live !== undefined || proof.outing !== undefined) throw new Error('Incomplete alpha receipts must remain explicit');
    return { profile, copies: [
      ['assertions.json', 'native-opening-assertions.json'], ['upgrade-install.json', 'upgrade-install-proof.json'],
      ['firebase-runtime.json', 'firebase-runtime-proof.json'], ['opening-visibility.json', 'opening-visibility-proof.json'],
    ], qualification: {
      schemaVersion: 1, publicationProfile: profile, qualification: 'alpha', publicationDecision: recipe.publicationDecision,
      version: recipe.version, build: recipe.build, sourceCommit: recipe.sourceCommit, sha256: recipe.sha256, bytes: recipe.bytes,
      buildRun: recipe.buildRun, qaRun: recipe.qaRun, pilotRun: recipe.pilotRun, liveRun: recipe.liveRun,
      upgradeFrom44Verified: true, signedOpeningAssertionsPassed: assertions.length, firebaseInitialized: true,
      liveAttempt: { conclusion: 'failure', publishedMenuRead: true, dishSearchRead: true, offlineDishSaveSynced: true,
        stoppedAt: 'Le nom de liste saisi sur l’émulateur a perdu son dernier chiffre.' },
      fullLiveReceipt: false, consoleModerationReceipt: false, physicalGuetReceipt: false,
      guetValidatedOnMobileAccordingToTeam: true, teamStatement: 'Guet validé sur mobile',
      pilot: proof.pilot, attributionAndLegacyFavoriteVerifiedOnSignedBinary: false,
      scope: 'Alpha publiée sur décision du propriétaire. Le support et la modération en production, la conservation du favori 42 et le parcours complet d’attribution restent à recevoir. L’équipe atteste le Guet sur mobile. Aucun nouveau reçu terrain pour cet APK.',
    } };
  }

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

export function prepareAndroidReleaseProof(recipe, { artifactDirectory = 'release-apk', proofDirectory = 'native-proof', pilotDirectory = 'pilot-native-proof', liveDirectory = 'partial-live-proof', visualDirectory = 'ui-native-proof' } = {}) {
  const profile = androidPublicationProfile(recipe);
  const read = name => JSON.parse(fs.readFileSync(path.join(proofDirectory, name), 'utf8'));
  const metadata = JSON.parse(fs.readFileSync(path.join(artifactDirectory, 'apk-metadata.json'), 'utf8'));
  const proof = { qaMetadata: read('apk-metadata.json'), assertions: read('assertions.json'), opening: read('opening-visibility.json'), firebase: read('firebase-runtime.json') };
  if (recipe.build >= 41) proof.upgrade = read('upgrade-install.json');
  if (profile === 'raccordements') {
    proof.raccordements = read('raccordements-data.json');
    if (fs.existsSync(path.join(proofDirectory, 'live-data.json'))) throw new Error('Pending receipts must remain explicitly unverified');
    proof.fingerprints = Object.fromEntries(Object.keys(BUILD42_PROOF_SHA256).map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(proofDirectory, name))).digest('hex')]));
  } else if (profile === 'dish48-alpha') {
    proof.dishRating = readDish48Receipt(recipe, proofDirectory);
  } else if (profile === 'pilot47-signed') {
    proof.pilot47 = readPilot47Receipt(recipe, visualDirectory, proofDirectory);
  } else if (profile === 'ui46-alpha') {
    proof.ui = loadUi46(recipe, proofDirectory, visualDirectory);
  } else if (profile === 'pilot45-alpha') {
    proof.pilot = receivePilot45Alpha(pilotDirectory);
    const actual = createHash('sha256').update(fs.readFileSync(path.join(liveDirectory, 'assertions.json'))).digest('hex');
    const liveMetadata = JSON.parse(fs.readFileSync(path.join(liveDirectory, 'apk-metadata.json'), 'utf8'));
    proof.partialLiveVerified = actual === '64ce4fdc2fa7769186d10b6a28c43fcea0368f8b533b0b4e56561de4c434f3b6' && liveMetadata.sha256 === recipe.sha256;
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
  if (profile === 'ui46-alpha') {
    for (const filename of ['carte.png','carte-adresse.png','mes-envies.png','mes-envies-adresse.png']) {
      const destination = path.join(artifactDirectory, filename);
      fs.copyFileSync(path.join(visualDirectory,filename), destination);
      assets.push(destination);
    }
  }
  if (profile === 'pilot47-signed') {
    const dest = path.join(artifactDirectory,'signed-pilot47-receipt.json');
    fs.copyFileSync(path.join(visualDirectory,'recu.json'),dest);
    assets.push(dest);
  }
  if (result.qualification) {
    const destination = path.join(artifactDirectory, 'release-qualification.json');
    fs.writeFileSync(destination, JSON.stringify(result.qualification, null, 2) + '\n');
    assets.push(destination);
  }
  return { metadata, profile, assets, qualification: result.qualification };
}
