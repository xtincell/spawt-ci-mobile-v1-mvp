import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function receiveUi46(recipe, signed, visual, readSignedScreenshot) {
  assert.equal(signed.build, 46);
  assert.equal(signed.sha256, recipe.sha256);
  assert.equal(signed.url, 'https://spawt.online/ouvrir/avis/le-cha-alexandre');
  assert.equal(signed.states.length, 2);
  for (const state of ['cold', 'warm']) {
    const evidence = signed.states.find(entry => entry.state === state);
    assert.equal(evidence?.title, 'Le Cha');
    for (const flag of ['author', 'quote', 'processVerified']) assert.equal(evidence[flag], true);
    assert.deepEqual(evidence.ratings, ['Cuisine 4,5/5', 'Cadre 4/5', 'Service 3/5']);
    assert.ok(Math.abs(evidence.photoAspectRatio - 0.75) < 0.025);
    assert.equal(createHash('sha256').update(readSignedScreenshot(state)).digest('hex'), evidence.screenshotSha256);
  }
  assert.equal(visual.source, recipe.uiWorkflowCommit);
  assert.match(visual.native, /debug x86_64 build 45/);
  for (const screen of ['Le Cha', 'Identification interne', 'Mes envies', 'Carte']) assert.equal(visual.screens[screen]?.pass, true);
  assert.ok(visual.lieu_sur_la_carte?.nom && visual.lieu_sur_la_carte?.quartier);
  assert.ok(visual.favoris_acquittes?.plat && visual.favoris_acquittes?.lieu);
  return { signedLeCha: true, clientScreens: ['Le Cha', 'Mes envies', 'Carte'],
    mapPointAndNeighborhood: true, savedPlaceAndDish: true, visualRun: recipe.uiRun,
    visualRuntime: visual.native, visualSource: visual.source };
}

export function loadUi46(recipe, proofDirectory, visualDirectory) {
  const read = file => JSON.parse(readFileSync(file, 'utf8'));
  const signed = read(path.join(proofDirectory,'le-cha-signed.json'));
  const visual = read(path.join(visualDirectory,'recu.json'));
  return receiveUi46(recipe,signed,visual,state => readFileSync(path.join(proofDirectory,'le-cha-'+state+'.png')));
}
