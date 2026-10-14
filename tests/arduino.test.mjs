import test from 'node:test';
import assert from 'node:assert/strict';
import { boards } from '../web/boards.js';
import { profiles, VERSION } from '../web/profiles.js';
import { DISPLAY_HEADERS, displayLibrary, ideSettings, libraries, sketchName, sketchPath } from '../web/arduino.js';
import { HEADERS, readSources, singleSketch } from '../scripts/arduino-sketch.mjs';

test('each board and display gets one self-contained sketch with only its display library', async () => {
  const sources = await readSources(), names = new Set();
  for (const board of boards) for (const profile of profiles) {
    const name = sketchName(board, profile), sketch = singleSketch(sources, board, profile, VERSION);
    assert.match(name, /^[A-Za-z][A-Za-z0-9_]*$/, 'a valid Arduino sketch name');
    assert.equal(sketchPath(board, profile), `arduino/${name}.ino`);
    names.add(name);
    assert.ok(sketch.includes(`#define BOARD_PROFILE ${board.firmwareId}\n#define DISPLAY_PROFILE ${profile.firmwareId}\n`));
    assert.ok(sketch.indexOf('#define DISPLAY_PROFILE') < sketch.indexOf('// ===== config.h ====='), 'the profile is fixed before config.h');
    assert.doesNotMatch(sketch, /#include "/, 'every local header is inlined');
    let previous = -1;
    for (const header of HEADERS) {
      const at = sketch.indexOf(`// ===== ${header} =====`);
      assert.ok(at > previous, `${header} is inlined once, in include order`);
      previous = at;
    }
    const display = displayLibrary(profile);
    for (const header of DISPLAY_HEADERS) assert.equal(sketch.includes(`#include <${header}>`), header === display.header, header);
    assert.ok(sketch.includes(display.name) && sketch.includes(`ESP32 Tilt Toy ${VERSION}`));
    assert.ok(sketch.includes('static const char fluidLicense[]'), 'the FLIP MIT notice travels with the code');
    assert.equal(libraries(profile).length, 3);
  }
  assert.equal(names.size, boards.length * profiles.length);
});

test('Tools settings follow the release FQBN, with USB CDC on the native-USB boards only', () => {
  for (const board of boards) {
    const settings = Object.fromEntries(ideSettings(board));
    assert.equal(settings.partition, 'Huge APP (3MB No OTA/1MB SPIFFS)');
    assert.equal(settings.flashMode, 'DIO');
    assert.equal(settings.flashSize, '4MB (32Mb)');
    assert.equal('cdc' in settings, board.target !== 'esp32');
    if (board.target !== 'esp32') assert.equal(settings.cdc, 'Enabled');
    assert.match(settings.board, /^ESP32(C3|C6)? Dev Module$/);
  }
  assert.throws(() => ideSettings({ ...boards[2], fqbn: 'esp32:esp32:esp32c6:PartitionScheme=default' }), /No Arduino IDE label/);
});
