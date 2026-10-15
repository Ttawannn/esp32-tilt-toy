import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { THEMES, findTheme } from '../web/themes.js';

test('web themes match the firmware colours, and the phone page offers every theme', async () => {
  const header = await readFile(new URL('../firmware/tilt_toy/themes.h', import.meta.url), 'utf8');
  const ids = [...header.match(/themeIds\[ThemeCount\] = \{([^}]*)\}/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, THEMES.map(t => t.id));
  // One table row per theme: shade 0 then 1-6, body, top, eye.
  const rows = header.split('\n').filter(line => line.trim().startsWith('{{{')).map(line => [...line.matchAll(/\d+/g)].map(Number));
  assert.equal(rows.length, THEMES.length);
  THEMES.forEach((theme, i) => assert.deepEqual(rows[i], [0, 0, 0, ...theme.rgb.shades.flat(), ...theme.rgb.body, ...theme.rgb.top, ...theme.rgb.eye], theme.id));
  assert.equal(findTheme('nope').id, 'ocean');
  // Ocean keeps the original blue water and cyan robot eyes.
  assert.deepEqual([THEMES[0].body, THEMES[0].top, THEMES[0].eye], ['#1fa2e0', '#9ee6fb', '#3cdcff']);
  const sketch = await readFile(new URL('../firmware/tilt_toy/tilt_toy.ino', import.meta.url), 'utf8');
  const options = [...sketch.match(/<select id="theme">(.*?)<\/select>/)[1].matchAll(/value="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(options, ids);
});
