import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sensors, profiles, findSensor, wiringConnections } from '../web/profiles.js';
import { boards } from '../web/boards.js';

test('each sensor uses the shared bus and its own I²C selection pins with every display', () => {
  assert.equal(findSensor('unknown').id, 'mpu6050');
  for (const board of boards) for (const sensor of sensors) for (const profile of profiles) {
    const connections = wiringConnections(profile, sensor.id, board);
    const endpoint = pin => connections.find(c => c.device === 'sensor' && c.pin === pin)?.boardPin;
    assert.equal(endpoint('SDA'), `GPIO${board.pins.SDA}`); assert.equal(endpoint('SCL'), `GPIO${board.pins.SCL}`);
    assert.equal(endpoint('VCC'), '3V3'); assert.equal(endpoint('GND'), 'GND');
    if (sensor.id === 'mpu6050') {
      assert.equal(endpoint('AD0'), 'GND'); assert.equal(endpoint('CS'), undefined);
    } else {
      assert.equal(endpoint('CS'), '3V3'); assert.equal(endpoint('SDO'), 'GND'); assert.equal(endpoint('AD0'), undefined);
    }
    assert.equal(new Set(connections.map(c => c.id)).size, connections.length);
    assert.deepEqual(connections.filter(c => c.device !== 'sensor'), wiringConnections(profile, 'mpu6050', board).filter(c => c.device !== 'sensor'));
  }
});

const compiler = process.env.CXX || 'g++';
const msvc = /(?:^|[/\\])cl(?:\.exe)?$/i.test(compiler);
const probe = spawnSync(compiler, msvc ? [] : ['--version'], { windowsHide: true });
test('C++ motion driver: identify chips, read signed SI units, reject I²C errors', { skip: probe.error ? 'Set CXX to a host C++ compiler (g++ / clang++ / cl)' : false }, async () => {
  const directory = resolve('work', 'motion-test');
  await mkdir(directory, { recursive: true });
  const executable = resolve(directory, process.platform === 'win32' ? 'motion-test.exe' : 'motion-test');
  const source = resolve('tests', 'motion', 'motion_sensor_test.cpp');
  const includes = resolve('tests', 'motion');
  const args = msvc ? ['/nologo', '/std:c++17', '/EHsc', '/W4', `/I${includes}`, source, `/Fe:${executable}`, `/Fo:${resolve(directory, 'motion-test.obj')}`] : ['-std=c++17', '-Wall', '-Wextra', '-Werror', `-I${includes}`, source, '-o', executable];
  const build = spawnSync(compiler, args, { cwd: directory, windowsHide: true, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const result = spawnSync(executable, [], { windowsHide: true, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
