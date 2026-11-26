import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { receiveUi46 } from '../validate-ui46-receipt.mjs';

const picture = Buffer.from('isolated unit test fixture');
const digest = createHash('sha256').update(picture).digest('hex');
const recipe = { sha256: 'a'.repeat(64), uiWorkflowCommit: 'b'.repeat(40) };
function fixture() {
  return {
    signed: { build: 46, sha256: recipe.sha256, url: 'https://spawt.online/ouvrir/avis/le-cha-alexandre',
      states: ['cold','warm'].map(state => ({ state, title: 'Le Cha', author: true, quote: true, processVerified: true,
        ratings: ['Cuisine 4,5/5','Cadre 4/5','Service 3/5'], photoAspectRatio: .75, screenshotSha256: digest })) },
    visual: { source: recipe.uiWorkflowCommit, native: 'APK signé Android 1.1.5 (46)', sha256: recipe.sha256, api:'https://api.spawt.online', etat_initial_retabli: true, screens: Object.fromEntries(
      ['Le Cha','Identification interne','Mes envies','Carte'].map(name => [name,{pass:true}])),
      lieu_sur_la_carte: { nom: 'Exemple', quartier: 'Marcory' }, favoris_acquittes: { plat:'exemple',lieu:'exemple',prix_xof:7000 } },
  };
}
test('compares both signed cold/warm and production-account visual evidence', () => {
  const { signed, visual } = fixture();
  const received = receiveUi46(recipe,signed,visual,() => picture);
  assert.equal(received.signedLeCha, true);
  assert.equal(received.visualRuntime, visual.native);
});
test('refuses a different APK, an incorrect culinary rating, a missing view or edited pixels', () => {
  for (const mutate of [
    f => { f.signed.sha256 = '0'.repeat(64); },
    f => { f.signed.states[0].ratings[0] = 'Cuisine 5/5'; },
    f => { f.visual.screens['Mes envies'].pass = false; },
    f => { f.signed.states[1].screenshotSha256 = 'modified'; },
  ]) {
    const data=fixture(); mutate(data);
    assert.throws(() => receiveUi46(recipe,data.signed,data.visual,() => picture));
  }
});
