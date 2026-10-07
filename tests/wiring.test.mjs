import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profiles, wiringConnections } from '../web/profiles.js';
import { matchingConnection } from '../web/wiring.js';

test('graph GPIO endpoints agree with firmware for every display profile', async () => {
  const config = await readFile(new URL('../firmware/tilt_toy/config.h', import.meta.url), 'utf8');
  const gpio = name => `GPIO${config.match(new RegExp(`#define TOY_${name} (\\d+)`))[1]}`;
  assert.equal(gpio('BUTTON'), 'GPIO9', 'use the onboard ESP32-C6 BOOT button');
  for (const profile of profiles) {
    const connections = wiringConnections(profile);
    const endpoint = (device, pin) => connections.find(c => c.device === device && c.pin === pin)?.boardPin;
    assert.equal(endpoint('sensor', 'SDA'), gpio('SDA'));
    assert.equal(endpoint('sensor', 'SCL'), gpio('SCL'));
    assert.equal(connections.some(c => c.device === 'button'), false, 'the onboard BOOT button needs no external wires');
    assert.equal(connections.some(c => ['GPIO2', 'GPIO9'].includes(c.boardPin)), false, 'neither the old button pin nor BOOT should need an external wire');
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
      assert.equal(endpoint('display', 'CS'), profile.cs >= 0 ? gpio('CS') : undefined);
    }
    assert.equal(connections.some(c => ['BL', 'BLK', 'INT'].includes(c.pin)), false, 'module-dependent backlight and unused interrupt must not suggest a firmware GPIO');
    assert.equal(new Set(connections.map(c => c.id)).size, connections.length, 'each device pin must have a unique wire');
  }
});

test('practice accepts either drag direction and rejects wrong pins, including SPI SDA versus I²C SDA', () => {
  const connections = wiringConnections(profiles.find(p => p.id === 'gmt130-240x240'));
  assert.equal(matchingConnection(connections, 'board:GPIO7', 'display:DIN')?.id, 'display:DIN');
  assert.equal(matchingConnection(connections, 'display:DIN', 'board:GPIO7')?.id, 'display:DIN');
  assert.equal(matchingConnection(connections, 'board:GPIO0', 'display:DIN'), undefined);
  assert.equal(matchingConnection(connections, 'board:3V3', 'sensor:GND'), undefined);
  assert.equal(matchingConnection(connections, 'display:GND', 'sensor:GND'), undefined);
  assert.equal(matchingConnection(connections, 'board:GPIO18', 'display:CS'), undefined);
  const oled = wiringConnections(profiles.find(p => p.mono));
  assert.ok(matchingConnection(oled, 'board:GPIO0', 'display:SDA'));
  assert.ok(matchingConnection(oled, 'board:GPIO0', 'sensor:SDA'));
});
