import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { headerSlots, profiles, sensors, wiringConnections } from '../web/profiles.js';
import { headerSlot, matchingConnection } from '../web/wiring.js';
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

test('every wire lands on a real header hole of the board and the module', () => {
  for (const board of boards) {
    assert.equal(board.header.left.length, board.header.right.length, `${board.id} headers are paired rows`);
    for (const profile of profiles) for (const sensor of sensors) {
      for (const c of wiringConnections(profile, sensor.id, board)) {
        assert.ok(headerSlot(board, c.boardPin), `${board.id} has no header hole for ${c.boardPin}`);
        const slots = headerSlots(c.device === 'display' ? profile.header : sensor.header);
        assert.equal(slots.filter(slot => slot.pin === c.pin).length, 1, `${profile.id} / ${sensor.id} needs one ${c.device} hole for ${c.pin}`);
      }
    }
  }
});

test('header order follows the module photos and wires follow the GPIO map', () => {
  const labels = id => headerSlots(profiles.find(p => p.id === id).header).map(slot => slot.label);
  assert.deepEqual(labels('tft-80x160'), ['GND', 'VCC', 'SCL', 'SDA', 'RES', 'DC', 'CS', 'BLK']);
  assert.deepEqual(labels('gmt130-240x240'), ['GND', 'VCC', 'SCK', 'SDA', 'RES', 'DC', 'BLK']);
  assert.deepEqual(labels('tft-240x240-gc9a01'), ['RST', 'CS', 'DC', 'SDA', 'SCL', 'GND', 'VCC']);
  assert.deepEqual(labels('oled-128x64'), ['GND', 'VCC', 'SCL', 'SDA']);
  const sensorLabels = id => headerSlots(sensors.find(sensor => sensor.id === id).header).map(slot => slot.label);
  assert.deepEqual(sensorLabels('mpu6050'), ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT']);
  assert.deepEqual(sensorLabels('bmi160'), ['VIN', '3.3V', 'GND', 'SCL', 'SDA', 'CS', 'SA0']);
  const c6 = boards.find(b => b.id === 'esp32-c6-supermini'), classic = boards.find(b => b.id === 'esp32-30pin');
  assert.deepEqual(headerSlot(c6, 'GPIO6'), { side: 'left', index: 8, label: '6' });
  assert.deepEqual(headerSlot(c6, '3V3'), { side: 'right', index: 2, label: '3V3' });
  assert.deepEqual(headerSlot(classic, 'GPIO23'), { side: 'right', index: 0, label: 'D23' });
  assert.deepEqual(headerSlot(classic, 'GND'), { side: 'right', index: 13, label: 'GND' }, 'GND uses the row facing the modules');
  const moved = { ...c6, pins: { ...c6.pins, SCK: 2 } };
  const clk = wiringConnections(profiles[0], 'mpu6050', moved).find(c => c.id === 'display:CLK');
  assert.deepEqual(headerSlot(moved, clk.boardPin), { side: 'left', index: 4, label: '2' }, 'changing a GPIO moves the wire to that hole');
});
