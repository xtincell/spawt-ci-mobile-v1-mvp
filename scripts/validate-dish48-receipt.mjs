import assert from 'node:assert/strict';

export function receiveDish48(recipe, proof) {
  assert.equal(proof.build, 48);
  assert.equal(proof.sha256, recipe.sha256);
  assert.equal(proof.source, recipe.sourceCommit);
  assert.equal(proof.api, 'https://api.spawt.online');
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
    observedStates: proof.checks.length, api:proof.api };
}
