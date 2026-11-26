import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const attestation = () => JSON.parse(readFileSync(new URL('../documentation/android-build47-native-receipt.json', import.meta.url)));

export function requirePilot47Recipe(recipe) {
  const pinned = attestation().recipe;
  assert.equal(recipe.publicationProfile, 'pilot47-signed');
  assert.equal(recipe.build, 47);
  assert.equal(recipe.sha256, '88042ac19e7c6d3af6626f761f25eab45bbe3d212651af05f0a8ab1e66214129');
  for (const [key, value] of Object.entries(pinned)) assert.equal(recipe[key], value, key);
}

export function readPilot47Receipt(recipe, visualDirectory, proofDirectory) {
  requirePilot47Recipe(recipe);
  const pinned = attestation();
  for (const [dir, files] of [[visualDirectory,pinned.visualFiles],[proofDirectory,pinned.standardFiles]]) {
    for (const [name, digest] of Object.entries(files)) {
      assert.equal(createHash('sha256').update(readFileSync(path.join(dir,name))).digest('hex'), digest, name);
    }
  }
  const r = JSON.parse(readFileSync(path.join(visualDirectory,'recu.json')));
  assert.equal(r.source, recipe.uiWorkflowCommit);
  assert.equal(r.build, 47);
  assert.equal(r.sha256, recipe.sha256);
  assert.equal(r.android_api, '35');
  assert.equal(r.api, 'https://api.spawt.online');
  for (const step of ['Mise à jour et installation propre','Identification interne','Mes envies']) assert.equal(r.screens[step]?.pass,true);
  assert.equal(r.mise_a_jour.de,45);
  assert.equal(r.mise_a_jour.vers,47);
  assert.equal(r.mise_a_jour.premiere_installation_et_uid_conserves,true);
  assert.equal(r.installation_propre.ecran,'splash-start');
  const place = 'c5acfd12-01dd-5cd3-9beb-0531d89c3e99';
  assert.equal(r.fiche_ouverte.lieu,place);
  assert.equal(r.serveur_apres_geste.lieu,place);
  assert.equal(r.favoris_acquittes.lieu,place);
  assert.equal(r.etat_initial_retabli,true);
  const timeline = [r.mise_a_jour.demarrage_confirme,r.installation_propre.at,r.favori_absent_avant,r.fiche_ouverte.at,r.serveur_apres_geste.at,r.redemarrage_authentifie,r.favori_apres_redemarrage].map(Date.parse);
  assert.ok(timeline.every((value,i) => Number.isFinite(value) && (i===0 || value >= timeline[i-1])));
  return { source:r.source, uiRun:recipe.uiRun, build:r.build, sha256:r.sha256, androidApi:35,
    previousPublicBuild:45, nativeFirstScreen:r.installation_propre.ecran, serverAcknowledgedPlace:place,
    favoriteReadAfterLauncherRestart:true, initialStateRestored:true };
}
