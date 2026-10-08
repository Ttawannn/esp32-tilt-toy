import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { boards, validateFirmwareImage } from '../web/boards.js';
import { profiles, sensors, modes, wiringConnections, validateRelease } from '../web/profiles.js';
import { getLanguage, messages, setLanguage, t } from '../web/i18n.js';

test('both languages cover the page and interpolate the same hardware/status values', async () => {
  for (const [key, [en, th]] of Object.entries(messages)) {
    assert.ok(en && th, `${key} needs both languages`);
    const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(placeholders(en), placeholders(th), `${key} must retain its values`);
  }
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en">/);
  for (const [, key] of html.matchAll(/data-i18n(?:-aria-label|-content)?="([^"]+)"/g)) assert.ok(messages[key], `Missing page translation: ${key}`);
  for (const file of ['app.js', 'wiring.js', 'profiles.js', 'boards.js', 'installer.js', 'flash-progress.js']) {
    const source = await readFile(new URL(`../web/${file}`, import.meta.url), 'utf8');
    for (const [, key] of source.matchAll(/\b(?:t|localizedError)\('([^']+)'/g)) assert.ok(messages[key], `Missing runtime translation: ${key}`);
  }
});

test('changing language preserves every board/display/sensor wire and firmware contract', () => {
  assert.equal(getLanguage(), 'en');
  const contract = () => boards.flatMap(board => profiles.flatMap(profile => sensors.map(sensor => ({
    board: board.id, display: profile.id, sensor: sensor.id,
    boardFirmware: board.firmwareId, displayFirmware: profile.firmwareId,
    wires: wiringConnections(profile, sensor.id, board).map(({ id, pin, boardPin, signal, from, to }) => ({ id, pin, boardPin, signal, from, to }))
  }))));
  const english = contract();
  try {
    setLanguage('th');
    assert.deepEqual(contract(), english);
    for (const mode of modes) assert.equal(mode.name, t(`mode.${mode.id}`));
    assert.throws(() => validateRelease(null, profiles[0]), error => error.message === t('release.profileError'));
    assert.throws(() => validateFirmwareImage(new Uint8Array(8)), error => error.message === t('release.incomplete'));
    assert.match(boards[0].note, /รุ่น/);
    setLanguage('en');
    assert.deepEqual(contract(), english);
    assert.equal(modes[0].name, 'Liquid');
    assert.doesNotMatch(profiles[0].note, /[ก-๙]/);
  } finally { setLanguage('en'); }
});
