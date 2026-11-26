import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requirePilot47Recipe } from '../validate-pilot47-receipt.mjs';
const { recipe } = JSON.parse(readFileSync(new URL('../../documentation/android-build47-native-receipt.json',import.meta.url)));
test('the signed 47 recipe is bound to the received binary and both emulator runs', () => {
  requirePilot47Recipe(recipe);
  for (const field of ['build','bytes','sha256','sourceCommit','buildRun','qaRun','uiRun','uiWorkflowCommit','publicationDecision']) {
    assert.throws(() => requirePilot47Recipe({ ...recipe, [field]: 'other' }));
  }
});
