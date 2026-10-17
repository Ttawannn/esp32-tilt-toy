import test from 'node:test';
import assert from 'node:assert/strict';
import { Puddle, DRY } from '../web/puddle.js';

// A 33×33 round vessel with its water in the lower half, as the side view leaves it.
const cols = 33, rows = 33, side = new Uint8Array(cols * rows);
for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
  const x = 2 * i + 1 - cols, y = 2 * j + 1 - rows;
  side[j * cols + i] = x * x + y * y > cols * cols ? 3 : j > 16 ? 1 : j === 16 ? 2 : 0;
}
const inside = [...side.keys()].filter(c => side[c] !== 3);
const run = (puddle, seconds, gravity, fill = 50) => { for (let t = 0; t < seconds; t += .025) puddle.update(.025, ...gravity(t), side, cols, rows, fill); };
const flat = () => [0, 0, 1];

test('standing up keeps the side view; lying flat spreads the water out of the side view over the whole floor', () => {
  const puddle = new Puddle();
  run(puddle, 2, () => [0, 1, 0]);
  assert.equal(puddle.amount, 0);
  assert.ok(puddle.look.every(v => v === 0));
  run(puddle, .35, flat);
  assert.ok(puddle.look.every(v => v === 0), 'a brief pass through flat does nothing');
  run(puddle, .2, flat);
  // Part way: the puddle has reached the cells beside the water but not the top of the vessel.
  assert.ok(puddle.look[20 * cols + 16] > 0 && puddle.look[2 * cols + 16] === 0);
  run(puddle, .6, flat);
  assert.equal(puddle.amount, 1);
  assert.ok(inside.every(c => puddle.look[c] >= 3 && puddle.look[c] <= 6), 'flat water covers every cell, no dry floor');
  assert.ok(puddle.look[16 * cols + 16] > puddle.look[16 * cols + 1], 'deeper shade in the middle than at the rim');
});

test('sensor noise while flat does not flicker the puddle', () => {
  const puddle = new Puddle();
  run(puddle, 2, flat);
  let changes = 0, previous = puddle.look.slice();
  for (let s = 0; s < 400; s++) {
    const n = .03 * Math.sin(s * 2.3), m = .03 * Math.cos(s * 3.7);
    puddle.update(.025, n, m, Math.sqrt(1 - n * n - m * m), side, cols, rows, 50);
    for (const c of inside) if (puddle.look[c] !== previous[c]) changes++;
    previous = puddle.look.slice();
  }
  assert.ok(changes / 400 < inside.length * .005, `${changes} cell changes over 400 frames`);
});

test('a small tilt drains the high side to bare floor with a shore, and standing up draws it back', () => {
  const puddle = new Puddle();
  run(puddle, 2, flat, 20);
  const g = .14;
  run(puddle, 1.5, () => [g, 0, Math.sqrt(1 - g * g)], 20);
  assert.ok(puddle.flat);
  assert.equal(puddle.look[16 * cols + 1], DRY, 'the raised left side is dry');
  assert.ok(puddle.look[16 * cols + 31] >= 3, 'the lowered right side is under water');
  assert.ok(inside.some(c => puddle.look[c] === 1), 'a shore between water and floor');
  const deep = c => puddle.look[c] >= 3 ? puddle.look[c] : 0;
  assert.ok(deep(16 * cols + 31) >= deep(16 * cols + 20), 'deeper toward the low side');
  run(puddle, .6, () => [.6, .8, 0], 20);
  assert.equal(puddle.amount, 0);
  assert.ok(puddle.look.every(v => v === 0), 'back to the side view');
});

test('a shake while flat sends a ring out from the middle; standing up or a partial puddle refuses it', () => {
  const puddle = new Puddle();
  run(puddle, .5, flat);
  assert.equal(puddle.ripple(0, 0), false, 'no ripple until the puddle covers the floor');
  run(puddle, 1, flat);
  assert.equal(puddle.ripple(0, 0), true);
  const crestDistance = () => {
    const at = inside.filter(c => puddle.look[c] === 2).map(c => Math.hypot(2 * (c % cols) + 1 - cols, 2 * Math.floor(c / cols) + 1 - rows));
    return at.length ? at.reduce((a, b) => a + b) / at.length : null;
  };
  run(puddle, .2, flat);
  const near = crestDistance();
  run(puddle, .3, flat);
  const far = crestDistance();
  assert.ok(near !== null && far !== null && far > near + 5, `the crest runs outward: ${near} then ${far}`);
  assert.ok(inside.some(c => puddle.look[c] >= 4), 'the band behind the crest is darker');
  run(puddle, 1.5, flat);
  assert.equal(crestDistance(), null, 'the ring has gone past the rim');
  run(puddle, .6, () => [.6, .8, 0]);
  assert.equal(puddle.ripple(0, 0), false, 'standing up: no ripples');
});
