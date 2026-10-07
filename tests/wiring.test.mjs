import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profiles, wiringConnections } from '../web/profiles.js';
import { matchingConnection } from '../web/wiring.js';
import { boards } from '../web/boards.js';

test('graph GPIO endpoints agree with firmware for every board and display profile', async () => {
  const config = await readFile(new URL('../firmware/tilt_toy/config.h', import.meta.url), 'utf8');
  for (const board of boards) {
  const section = config.split(new RegExp(`#(?:if|elif) BOARD_PROFILE == ${board.firmwareId}\\r?\\n`))[1].split(/#elif BOARD_PROFILE|#else\r?\n#error Unknown BOARD_PROFILE/)[0];
  const gpio = name => `GPIO${section.match(new RegExp(`#define TOY_${name} (\\d+)`))[1]}`;
  for (const [name, pin] of Object.entries(board.pins)) assert.equal(gpio(name), `GPIO${pin}`);
  assert.equal(gpio('BUTTON'), board.target === 'esp32' ? 'GPIO0' : 'GPIO9');
  for (const profile of profiles) {
    const connections = wiringConnections(profile, 'mpu6050', board);
    const endpoint = (device, pin) => connections.find(c => c.device === device && c.pin === pin)?.boardPin;
    assert.equal(endpoint('sensor', 'SDA'), gpio('SDA'));
    assert.equal(endpoint('sensor', 'SCL'), gpio('SCL'));
    assert.equal(connections.some(c => c.device === 'button'), false, 'the onboard BOOT button needs no external wires');
    assert.equal(connections.some(c => c.boardPin === gpio('BUTTON')), false, 'BOOT should need no external wire');
    assert.equal(connections.some(c => board.reserved.map(pin => `GPIO${pin}`).includes(c.boardPin)), false, 'keep flash/USB/input-only/strapping pins out of external wiring');
    assert.equal(endpoint('sensor', 'AD0'), 'GND');
    for (const device of ['sensor', 'display']) {
      assert.equal(endpoint(device, 'VCC'), '3V3');
      assert.equal(endpoint(device, 'GND'), 'GND');
    }
    if (profile.mono) {
      assert.equal(endpoint('display', 'SDA'), gpio('SDA'));
      assert.equal(endpoint('display', 'SCL'), gpio('SCL'));
      assert.equal(endpoint('display', 'CLK'), undefined);
    } else {
      for (const [pin, macro] of [['CLK', 'SCK'], ['DIN', 'MOSI'], ['DC', 'DC'], ['RST', 'RST']]) assert.equal(endpoint('display', pin), gpio(macro));
      assert.equal(endpoint('display', 'CS'), profile.hasCs ? gpio('CS') : undefined);
    }
    assert.equal(connections.some(c => ['BL', 'BLK', 'INT'].includes(c.pin)), false, 'module-dependent backlight and unused interrupt must not suggest a firmware GPIO');
    assert.equal(new Set(connections.map(c => c.id)).size, connections.length, 'each device pin must have a unique wire');
  }
  }
});

test('practice accepts either drag direction and rejects wrong pins, including SPI SDA versus I²C SDA', () => {
  for (const board of boards) {
  const connections = wiringConnections(profiles.find(p => p.id === 'gmt130-240x240'), 'mpu6050', board);
  const mosi = `board:GPIO${board.pins.MOSI}`, sda = `board:GPIO${board.pins.SDA}`;
  assert.equal(matchingConnection(connections, mosi, 'display:DIN')?.id, 'display:DIN');
  assert.equal(matchingConnection(connections, 'display:DIN', mosi)?.id, 'display:DIN');
  assert.equal(matchingConnection(connections, sda, 'display:DIN'), undefined);
  assert.equal(matchingConnection(connections, 'board:3V3', 'sensor:GND'), undefined);
  assert.equal(matchingConnection(connections, 'display:GND', 'sensor:GND'), undefined);
  assert.equal(matchingConnection(connections, `board:GPIO${board.pins.CS}`, 'display:CS'), undefined);
  const oled = wiringConnections(profiles.find(p => p.mono), 'mpu6050', board);
  assert.ok(matchingConnection(oled, sda, 'display:SDA'));
  assert.ok(matchingConnection(oled, sda, 'sensor:SDA'));
  }
});
