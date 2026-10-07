import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { profiles, sensors, wiringConnections } from '../web/profiles.js';
import { matchingConnection } from '../web/wiring.js';
import { boardLayout, displayLayout, sensorLayout, wirePath } from '../web/wiring-layout.js';
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

test('physical header order follows the component-side reference photos', () => {
  const labels = ports => ports.map(p => p.label);
  assert.deepEqual(labels(boardLayout(boards[0]).pins.filter(p => p.dx < 0)), ['EN', 'GPIO36', 'GPIO39', 'GPIO34', 'GPIO35', 'GPIO32', 'GPIO33', 'GPIO25', 'GPIO26', 'GPIO27', 'GPIO14', 'GPIO12', 'GPIO13', 'GND', 'VIN']);
  assert.deepEqual(labels(boardLayout(boards[1]).pins.filter(p => p.dx > 0)), ['5V', 'GND', '3V3', 'GPIO4', 'GPIO3', 'GPIO2', 'GPIO1', 'GPIO0']);
  assert.deepEqual(labels(boardLayout(boards[2]).pins.filter(p => p.dx < 0)), ['GPIO16', 'GPIO17', 'GPIO0', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5', 'GPIO6', 'GPIO7']);
  assert.deepEqual(labels(displayLayout(profiles.find(p => p.mono)).pins), ['GND', 'VCC', 'SCL', 'SDA']);
  assert.deepEqual(labels(displayLayout(profiles.find(p => p.id === 'gmt130-240x240')).pins), ['GND', 'VCC', 'SCK', 'SDA', 'RES', 'DC', 'BLK']);
  assert.deepEqual(labels(displayLayout(profiles.find(p => p.shape === 'round')).pins), ['RST', 'CS', 'DC', 'DIN', 'SCK', 'GND', 'VCC', 'BL']);
  assert.deepEqual(labels(sensorLayout(sensors[0]).pins), ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT']);
  assert.deepEqual(labels(sensorLayout(sensors[1]).pins.filter(p => p.dx < 0)), ['VIN', '3V3', 'GND', 'SCL', 'SDA', 'CS', 'SA0']);
  assert.deepEqual(displayLayout(profiles[0]).pins, displayLayout(profiles[1]).pins, 'software rotation does not move the physical display header');
});

test('every fixed firmware wire lands on a physical header for all component combinations', () => {
  for (const board of boards) for (const profile of profiles) for (const sensor of sensors) {
    const layouts = [boardLayout(board), displayLayout(profile), sensorLayout(sensor)];
    const ports = new Map(layouts.flatMap(layout => layout.pins.map(p => [p.id, p])));
    assert.equal(ports.size, layouts.flatMap(l => l.pins).length, 'physical pin IDs must be unique');
    for (const layout of layouts) for (const p of layout.pins) {
      assert.ok(p.x >= layout.bounds.x && p.x <= layout.bounds.x + layout.bounds.width);
      assert.ok(p.y >= layout.bounds.y && p.y <= layout.bounds.y + layout.bounds.height);
    }
    const connections = wiringConnections(profile, sensor.id, board);
    for (const [lane, connection] of connections.entries()) {
      const target = ports.get(connection.to);
      assert.ok(target, `missing ${connection.to}`);
      const a = ports.get(connection.from);
      assert.ok(a, `missing ${board.id} ${connection.from}`);
      const path = wirePath(a, target, lane);
      assert.ok(path.startsWith(`M${a.x},${a.y}`));
      assert.ok(path.endsWith(`L${target.x},${target.y}`));
      assert.equal(/NaN|undefined|Infinity/.test(path), false);
    }
  }
});

test('wire routing retains the outside PCB corners when intermediate points coincide', () => {
  const path = wirePath({ x: 148, y: 260, dx: -1, dy: 0 }, { x: 746, y: 582, dx: -1, dy: 0 }, 1);
  assert.ok(path.includes('Q423,717'), 'turn into the corridor below the PCB instead of taking a diagonal shortcut across it');
});
