// One self-contained .ino per board and display for Arduino IDE users: the sketch with its
// local headers inlined where it includes them, the board and display fixed by #define,
// and only that display's library included. The release firmware builds the same sources.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CORE, DISPLAY_HEADERS, displayLibrary, ideSettings, libraries, sketchName } from '../web/arduino.js';

const root = resolve(import.meta.dirname, '..');
// In #include order: each header is placed where the sketch includes it.
export const HEADERS = ['config.h', 'motion_sensor.h', 'motion_state.h', 'flip_fluid.h', 'pixel_flow.h', 'toy_modes.h', 'robot_eyes.h'];
const SETTING_LABELS = { board: 'Board', cdc: 'USB CDC On Boot', flashSize: 'Flash Size', flashMode: 'Flash Mode', partition: 'Partition Scheme', uploadSpeed: 'Upload Speed', port: 'Port' };

export async function readSources() {
  const read = async file => (await readFile(resolve(root, 'firmware', 'tilt_toy', file), 'utf8')).replace(/\r\n/g, '\n');
  const sources = { 'tilt_toy.ino': await read('tilt_toy.ino') };
  for (const header of HEADERS) sources[header] = await read(header);
  return sources;
}

export function singleSketch(sources, board, profile, version) {
  let sketch = sources['tilt_toy.ino'];
  const display = displayLibrary(profile);
  for (const header of DISPLAY_HEADERS) {
    const line = `#include <${header}>\n`;
    if (!sketch.includes(line)) throw Error(`tilt_toy.ino no longer includes ${header}`);
    if (header !== display.header) sketch = sketch.replace(line, '');
  }
  for (const header of HEADERS) {
    const line = `#include "${header}"\n`;
    if (!sketch.includes(line)) throw Error(`tilt_toy.ino no longer includes ${header}`);
    const body = sources[header].split('\n').filter(text => !/^#pragma once/.test(text) && !/^#include "/.test(text)).join('\n').trim();
    sketch = sketch.replace(line, `// ===== ${header} =====\n${body}\n\n`);
  }
  if (/#include "/.test(sketch)) throw Error('A local include was not inlined');
  const settings = ideSettings(board).map(([key, value]) => `//   ${SETTING_LABELS[key].padEnd(17)} ${value}`).join('\n');
  const banner = `// ESP32 Tilt Toy ${version} — single-file sketch: ${sketchName(board, profile)}
// Board:   ${board.name}
// Display: ${profile.name} (${profile.driver})
// Sensor:  BMI160 or MPU6050 on I2C, detected at power-up
//
// Arduino IDE: install "${CORE.name}" ${CORE.version} (Boards Manager URL ${CORE.url}),
// then the libraries ${libraries(profile).map(([name, v]) => `"${name}" ${v}`).join(', ')}.
// Tools menu:
${settings}
// Wiring: see the wiring diagram on the web installer for this board and display.
// Serial Monitor: 115200. Hold BOOT 5 s for axis setup, 2 s for the Wi-Fi settings page.
//
// Generated from firmware/tilt_toy. Edit those files, not this one.
#define BOARD_PROFILE ${board.firmwareId}
#define DISPLAY_PROFILE ${profile.firmwareId}
`;
  return `${banner}\n${sketch}`;
}
