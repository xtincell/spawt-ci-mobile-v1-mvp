import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../check-eas-env.mjs', import.meta.url));
function run(body) {
  const preload = `globalThis.fetch = async () => { ${body} };`;
  return spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, script, 'preview'], { encoding: 'utf8' });
}
test('a confirmed GoTrue response accepts the configured gateway key', () => {
  const result = run('return new Response(JSON.stringify({error_code:"no_authorization"}), {status:401});');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /clé acceptée/);
});
for (const [name, body] of [
  ['network outage', 'throw new TypeError("fetch failed");'],
  ['Kong rejection', 'return new Response(JSON.stringify({message:"Unauthorized"}), {status:401});'],
  ['GoTrue server failure', 'return new Response(JSON.stringify({error_code:"unexpected_failure",msg:"Database error"}), {status:500});'],
]) {
  test(`${name} blocks a distributable build`, () => {
    const result = run(body);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /tous les profils distribuables sont branchés/);
  });
}
