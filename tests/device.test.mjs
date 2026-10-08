import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { boards } from '../web/boards.js';

test('phone controls display each detected sensor and offer calibration only while the sensor responds', async () => {
  const sketch = await readFile(new URL('../firmware/tilt_toy/tilt_toy.ino', import.meta.url), 'utf8');
  const script = sketch.match(/R"HTML\([\s\S]*?<script>([\s\S]*?)<\/script>/)[1];
  for (const board of boards) for (const [sensor, sensorAddress, gyro] of [['BMI160', 0x69, true], ['MPU6050', 0x68, true]]) {
    const elements = new Map();
    const get = id => {
      if (!elements.has(id)) elements.set(id, { value: '', textContent: '', hidden: false, dataset: {}, options: [] });
      return elements.get(id);
    };
    let state = { board: board.id, boardName: board.name, chipFamily: board.chipFamily, profile: 'oled-128x64', version: '0.1.2', mode: 'water', fill: 50, sensitivity: 1, rotation: 0, invert: false, spiMode: 0, imu: true, sensor, sensorAddress, gyro, roll: 12, pitch: -5, fps: 20, score: 0, simMs: 5, particles: 100, freeHeap: 180000, axisX: 1, axisY: 2, axisZ: 3, gravity: [0,.98,-.1], omega: [0,0,1.5], linear: [2,0,0] };
    let poll;
    const requests = [];
    runInNewContext(script, {
      document: { getElementById: get, hidden: false },
      AbortSignal, URLSearchParams,
      setInterval(callback) { poll = callback; },
      async fetch(path, options) {
        requests.push([path, options]);
        return { ok: true, async json() { return state; } };
      }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(get('hardware').textContent.startsWith(board.name+' · '));
    assert.ok(get('hardware').textContent.includes(`${sensor} · 0x${sensorAddress.toString(16).toUpperCase()}`));
    assert.equal(get('calibrate').hidden, !gyro);
    assert.equal(get('vRoll').textContent, '+12°');
    assert.equal(get('invertWrap').hidden, true);
    assert.equal(get('vOmega').textContent,'0.00 / 0.00 / 1.50');
    assert.equal(get('axisZ').value,'3');
    get('axisX').value='-1';get('axisY').value='-2';await get('save').onclick();
    assert.equal(requests.at(-1)[1].body.get('axisX'),'-1');
    assert.equal(requests.at(-1)[1].body.get('axisY'),'-2');
    if (gyro) {
      await get('calibrate').onclick();
      assert.equal(requests.at(-1)[0], '/api/calibrate');
      assert.equal(requests.at(-1)[1].method, 'POST');
    }
    for (const [mode,name] of [['water','น้ำปกติ'],['water-inertia','น้ำมีแรงเฉื่อย'],['water-swirl','น้ำวน']]) {
      state={...state,mode};await poll();
      assert.equal(get('vMode').textContent,name);
      assert.equal(get('sSim').hidden,false);assert.equal(get('sParticles').hidden,false);
      assert.equal(get('shake').hidden,mode!=='water');
      get('mode').value=mode;await get('save').onclick();
      assert.equal(requests.at(-1)[1].body.get('mode'),mode);
    }
    state = { ...state, imu: false };
    await poll();
    assert.ok(get('hardware').textContent.includes('ไม่พบเซนเซอร์'));
    assert.equal(get('calibrate').hidden, true);
    assert.equal(get('vRoll').textContent, '–');
  }
});
