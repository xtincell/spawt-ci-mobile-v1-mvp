import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { receivePilot45 } from '../validate-pilot45-receipt.mjs';

const place = 'c5acfd12-01dd-5cd3-9beb-0531d89c3e99';
const accountAlias = 'INTERNAL-FIXTURE';

function receipts(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'spawt-pilot45-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, 'le-cha'));
  const write = (name, data) => writeFileSync(path.join(directory, name), JSON.stringify(data));
  const update = (name, edit) => {
    const data = JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
    edit(data);
    write(name, data);
  };
  writeFileSync(path.join(directory, 'verified-links.txt'), 'spawt.online: verified');
  write('le-cha/recu-navigation.json', {
    build: 45, url: 'https://spawt.online/ouvrir/avis/le-cha-alexandre',
    browser: 'com.android.chrome', browser_version: 'test',
    checks: ['cold', 'warm'].map(state => ({
      state, title: 'Le Cha', ratings: ['Cuisine 5/5', 'Cadre 4/5', 'Service 3/5'],
      process_verified: true, quote: true, photo: true,
    })),
  });
  for (const source of ['facebook', 'instagram']) {
    const journey = 'test-' + source;
    write(source + '.json', { build: 45, journey, server: {
      journey, source, population: 'interne', alias: accountAlias, acquisition: true,
      actions: [
        { event: 'place_viewed', applied: true, place, at_utc: '2026-11-25T10:00:00.001Z' },
        { event: 'saved_place_added', applied: true, place, at_utc: '2026-11-25T10:00:00.002Z', ack_utc: '2026-11-25T10:00:01.002Z' },
      ],
    } });
  }
  write('favori-mise-a-jour.json', { from: 42, to: 45, legacy_server_ack: true, after_upgrade_favorite_visible: true, server: { acquisition: false } });
  write('carte-processus.json', { same_process: true, remount_same_process: true, crash_buffer: false, controls: true });
  return { directory, update };
}

test('publishes aggregate results from received browser, server and upgrade proofs', t => {
  const { directory } = receipts(t);
  const result = receivePilot45(directory);
  assert.deepEqual(result.syntheticHandoffsReceived, ['facebook', 'instagram']);
  assert.equal(result.reviewOpenedColdAndWarm, true);
  assert.equal(JSON.stringify(result).includes(accountAlias), false);
});

for (const [name, file, mutate] of [
  ['warm browser navigation missing', 'le-cha/recu-navigation.json', r => r.checks.pop()],
  ['incorrect rating', 'le-cha/recu-navigation.json', r => r.checks[1].ratings.pop()],
  ['wrong account population', 'facebook.json', r => { r.server.population = 'demo'; }],
  ['unacknowledged favorite', 'instagram.json', r => { r.server.actions[1].applied = false; }],
  ['favorite preceded view', 'instagram.json', r => { r.server.actions[0].at_utc = '2026-11-25T12:00:00Z'; }],
  ['upgrade counted as new acquisition', 'favori-mise-a-jour.json', r => { r.server.acquisition = true; }],
  ['crash on map', 'carte-processus.json', r => { r.crash_buffer = true; }],
]) {
  test('rejects ' + name, t => {
    const { directory, update } = receipts(t);
    update(file, mutate);
    assert.throws(() => receivePilot45(directory));
  });
}
