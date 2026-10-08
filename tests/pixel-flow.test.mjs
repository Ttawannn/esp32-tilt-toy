import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PixelFlow, pixelLayout, forceToQ8, direction, SHAPE_RECT, SHAPE_ROUNDED, SHAPE_CIRCLE, MAX_CELLS, MAX_DROPS } from '../web/pixel-flow.js';
import { profiles } from '../web/profiles.js';
import { ToyPreview } from '../web/preview.js';

const tilt = deg => { const r = deg*Math.PI/180; return [forceToQ8(4*Math.sin(r)), forceToQ8(4*Math.cos(r))]; };
const settle = (f, ax, ay, steps = 300) => { for (let i = 0; i < steps; i++) f.step(ax, ay); };
// Grid and drop arrays describe the same cells: one drop per cell, none in a wall.
function assertConsistent(f, expectedCount) {
  assert.equal(f.count, expectedCount);
  const seen = new Set();
  for (let p = 0; p < f.count; p++) {
    const c = f.row[p]*f.cols+f.col[p];
    assert.ok(f.col[p] < f.cols && f.row[p] < f.rows, `drop ${p} inside the grid`);
    assert.equal(f.grid[c], p, `cell ${c} holds drop ${p}`);
    assert.ok(!seen.has(c)); seen.add(c);
  }
  let drops = 0;
  for (let c = 0; c < f.cols*f.rows; c++) if (f.grid[c] >= 0) drops++;
  assert.equal(drops, f.count);
}
const columnHeights = f => Array.from({ length: f.cols }, (_, i) => { let n = 0; for (let j = 0; j < f.rows; j++) if (f.grid[j*f.cols+i] >= 0) n++; return n; });
const loose = f => { let n = 0; for (let p = 0; p < f.count; p++) { const i = f.col[p], j = f.row[p]; if (![[1,0],[-1,0],[0,1],[0,-1]].some(([a,b]) => i+a >= 0 && i+a < f.cols && j+b >= 0 && j+b < f.rows && f.grid[(j+b)*f.cols+i+a] >= 0)) n++; } return n; };

test('drops are conserved, unique and inside every vessel shape under random forces and shakes', () => {
  for (const shape of [SHAPE_RECT, SHAPE_ROUNDED, SHAPE_CIRCLE]) for (const fill of [10, 50, 90]) {
    const f = new PixelFlow(40, 40, shape, fill, 11), count = f.count;
    let seed = 7;
    const next = () => (seed = (seed*1103515245+12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 600; i++) {
      const ax = Math.round(next()*400-200), ay = Math.round(next()*400-200);
      if (i % 100 === 50) f.shake(ax, ay);
      f.step(ax, ay);
    }
    assertConsistent(f, count);
  }
});

test('settled water has a full bottom row, level columns and a pale surface row', () => {
  const f = new PixelFlow(40, 24, SHAPE_RECT, 50, 3);
  settle(f, 0, 64);
  const heights = columnHeights(f), look = f.shade(0, 64);
  assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, `heights ${heights}`);
  for (let i = 0; i < f.cols; i++) {
    assert.ok(f.grid[(f.rows-1)*f.cols+i] >= 0, `bottom cell ${i} is water`);
    const top = f.rows - heights[i];
    assert.equal(look[top*f.cols+i], 1, `column ${i} starts with a surface drop`);
    for (let j = top+1; j < f.rows; j++) assert.ok(look[j*f.cols+i] >= 3, `column ${i} row ${j} is body`);
  }
});

test('the surface settles across the true gravity at any angle, not only the eight grid directions', () => {
  for (const shape of [SHAPE_RECT, SHAPE_ROUNDED, SHAPE_CIRCLE]) for (const deg of [0, 10, 20, 35, 45, 60, 90, 135, 200, 300]) {
    const [ax, ay] = tilt(deg), length = Math.hypot(ax, ay), f = new PixelFlow(40, 40, shape, 50, deg+1);
    settle(f, ax, ay, 400);
    const look = f.shade(ax, ay);
    let low = Infinity, high = -Infinity;
    for (let p = 0; p < f.count; p++) if (look[f.row[p]*f.cols+f.col[p]] === 1) {
      const depth = (f.col[p]*ax + f.row[p]*ay) / length; low = Math.min(low, depth); high = Math.max(high, depth);
    }
    assert.ok(high - low <= 4.5, `shape ${shape} at ${deg}°: surface spread ${(high-low).toFixed(2)} cells`);
    // Water collects on the side gravity points to.
    let mass = 0; for (let p = 0; p < f.count; p++) mass += (f.col[p]+.5-f.cols/2)*ax + (f.row[p]+.5-f.rows/2)*ay;
    assert.ok(mass/f.count/length > 4, `shape ${shape} at ${deg}°: water sits downhill`);
  }
});

test('drops keep their momentum: a pushed body keeps moving together, then levels again under gravity', () => {
  const f = new PixelFlow(40, 24, SHAPE_RECT, 30, 5);
  settle(f, 64, 0);
  const centre = () => { let x = 0; for (let p = 0; p < f.count; p++) x += f.col[p]; return x/f.count; };
  const start = centre();
  // Weightless: only the push moves the slab off the right wall.
  f.push(f.cols-1, 12, -500, 0, 60);
  settle(f, 0, 0, 4);
  const early = centre();
  settle(f, 0, 0, 4);
  assert.ok(start - early > 2 && early - centre() > 2, `moved ${(start-early).toFixed(2)} then ${(early-centre()).toFixed(2)} cells`);
  assert.ok(loose(f) < f.count/10, `${loose(f)} of ${f.count} drops broke away`);
  settle(f, 0, 64, 300);
  const heights = columnHeights(f);
  assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, `levels again: ${heights}`);
});

test('a shake throws single drops into the air and they fall back', () => {
  const f = new PixelFlow(40, 40, SHAPE_ROUNDED, 50, 9);
  settle(f, 0, 64);
  assert.equal(loose(f), 0);
  f.shake(0, 64);
  settle(f, 0, 64, 4);
  assert.ok(loose(f) >= 5, `${loose(f)} drops in the air`);
  settle(f, 0, 64, 200);
  assert.ok(loose(f) <= 1, `${loose(f)} drops still in the air`);
});

test('a falling or sloshing mass is shaded as surface, spray and body, never as gaps inside', () => {
  const f = new PixelFlow(40, 40, SHAPE_ROUNDED, 50, 2);
  settle(f, 0, 64);
  for (let i = 0; i < 10; i++) f.step(0, -64);
  const look = f.shade(0, -64);
  const counts = [0,0,0,0,0,0,0];
  for (let c = 0; c < f.cols*f.rows; c++) counts[look[c]]++;
  assert.ok(counts[1] > 0 && counts[2] > 0 && counts[3]+counts[4]+counts[5]+counts[6] > 0, `shades ${counts}`);
  for (let j = 1; j < f.rows-1; j++) for (let i = 1; i < f.cols-1; i++) {
    const c = j*f.cols+i, around = [c-1, c+1, c-f.cols, c+f.cols].filter(k => f.grid[k] >= 0).length;
    if (f.grid[c] === -1 && around >= 3) assert.equal(look[c], 3, 'a one-cell hole inside the water is drawn as water');
  }
});

test('fill level, eight-way directions and per-profile grids fit the fixed storage', () => {
  for (const fill of [10, 50, 90]) {
    const f = new PixelFlow(40, 40, SHAPE_CIRCLE, fill, 1);
    assert.equal(f.count, Math.trunc(f.usable*fill/100));
  }
  assert.deepEqual([[64,0],[50,50],[0,64],[-50,50],[-64,0],[-50,-50],[0,-64],[50,-50],[0,0],[64,20],[20,64]].map(([x,y]) => direction(x,y)), [0,1,2,3,4,5,6,7,2,0,2]);
  for (const p of profiles) {
    const l = pixelLayout(p.width, p.height, p.shape === 'round', !!p.mono);
    assert.ok(l.cols*l.rows <= MAX_CELLS && l.cols*l.pitch <= p.width && l.rows*l.pitch <= p.height, p.id);
    const f = new PixelFlow(l.cols, l.rows, l.shape, 90, 1);
    assert.ok(f.count <= MAX_DROPS && f.count === Math.trunc(f.usable*.9), `${p.id}: ${f.count} drops`);
  }
  assert.deepEqual(pixelLayout(240, 240, false), { pitch: 6, cols: 40, rows: 40, x: 0, y: 0, shape: SHAPE_ROUNDED });
  assert.deepEqual(pixelLayout(128, 64, false, true), { pitch: 2, cols: 64, rows: 32, x: 0, y: 0, shape: SHAPE_RECT });
});

test('the same seed and inputs give the same water', () => {
  const run = seed => { const f = new PixelFlow(30, 30, SHAPE_ROUNDED, 50, seed); for (let i = 0; i < 200; i++) { if (i === 40) f.shake(30, 50); f.step(30, 50); } return Array.from(f.grid.subarray(0, 900)); };
  assert.deepEqual(run(4), run(4));
  assert.notDeepEqual(run(4), run(5));
});

test('preview runs pixel-flow on its own grid at 30 steps per second and feels jolts', () => {
  const previous = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => {};
  try {
    const ctx = new Proxy({}, { get: () => () => {} }), canvas = { width: 240, height: 240, getContext: () => ctx, addEventListener: () => {} };
    const p = new ToyPreview(canvas); p.setMode('pixel-flow');
    assert.deepEqual([p.drops.cols, p.drops.rows, p.drops.shape], [40, 40, SHAPE_ROUNDED]);
    assert.equal(p.drops.count, Math.trunc(p.drops.usable*.5));
    for (let i = 0; i < 60; i++) p.draw(i*.025, .025);
    assert.ok(p.drops.steps >= 44 && p.drops.steps <= 45, `${p.drops.steps} steps in 1.5 s`);
    assert.deepEqual(p.pixelForce, [0, 64]);
    p.jolt(12, 0); p.draw(1.5, .025);
    assert.ok(p.pixelForce[0] < -32, `a jolt to the right pushes the water left: ${p.pixelForce}`);
    p.setFill(80); assert.equal(p.drops.count, Math.trunc(p.drops.usable*.8));
    p.setProfile({ width: 128, height: 64, mono: true, shape: 'rectangle' });
    assert.deepEqual([p.drops.cols, p.drops.rows, p.drops.shape], [64, 32, SHAPE_RECT]);
  } finally { globalThis.requestAnimationFrame = previous; }
});

// FNV-1a over 16-bit values, mirrored in tests/motion/pixel_flow_parity.cpp.
const fnv = values => { let h = 2166136261; for (const v of values) { h ^= v & 0xffff; h = Math.imul(h, 16777619) >>> 0; } return h; };
const compiler = process.env.CXX || 'g++', msvc = /(?:^|[/\\])cl(?:\.exe)?$/i.test(compiler);
const probe = spawnSync(compiler, msvc ? [] : ['--version'], { windowsHide: true });
test('C++ and JS produce the same grid, velocities and shading bit for bit', { skip: probe.error ? 'Set CXX to g++ / clang++ / cl' : false }, async () => {
  const dir = resolve('work', 'pixel-parity'); await mkdir(dir, { recursive: true });
  const exe = resolve(dir, process.platform === 'win32' ? 'parity.exe' : 'parity'), src = resolve('tests/motion/pixel_flow_parity.cpp'), includes = resolve('tests/motion');
  const args = msvc ? ['/nologo', '/std:c++17', '/EHsc', '/W4', `/I${includes}`, src, `/Fe:${exe}`, `/Fo:${resolve(dir, 'parity.obj')}`] : ['-std=c++17', '-Wall', '-Wextra', '-Werror', `-I${includes}`, src, '-o', exe];
  const build = spawnSync(compiler, args, { cwd: dir, windowsHide: true, encoding: 'utf8' }); assert.equal(build.status, 0, build.stdout+build.stderr);
  const input = [], expected = [];
  const state = f => fnv([...f.grid.subarray(0, f.cols*f.rows), ...f.vx.subarray(0, f.count), ...f.vy.subarray(0, f.count), ...f.fx.subarray(0, f.count), ...f.fy.subarray(0, f.count)]);
  for (const [cols, rows, shape, fill, seed] of [[40,40,SHAPE_ROUNDED,50,3],[30,30,SHAPE_CIRCLE,70,8],[64,32,SHAPE_RECT,20,21],[20,40,SHAPE_ROUNDED,90,5]]) {
    const f = new PixelFlow(cols, rows, shape, fill, seed);
    input.push(`C ${cols} ${rows} ${shape} ${fill} ${seed}`); expected.push(`${f.count} ${state(f)}`);
    for (let i = 0; i < 400; i++) {
      const [ax, ay] = tilt(i*2.7 + (i > 200 ? 180 : 0));
      if (i % 97 === 30) { f.shake(ax, ay); input.push(`K ${ax} ${ay}`); }
      if (i % 131 === 60) { f.push(cols>>1, rows>>1, -300, 200, 5); input.push(`P ${cols>>1} ${rows>>1} -300 200 5`); }
      f.step(ax, ay); input.push(`S ${ax} ${ay}`); expected.push(`${state(f)}`);
      if (i % 50 === 0) { input.push(`L ${ax} ${ay} ${i}`); expected.push(`${fnv(f.shade(ax, ay, i).subarray(0, cols*rows))}`); }
    }
  }
  const run = spawnSync(exe, [], { input: input.join('\n')+'\n', windowsHide: true, encoding: 'utf8', maxBuffer: 1 << 24 }); assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, expected.length);
  lines.forEach((line, i) => assert.equal(line, expected[i], `output line ${i}`));
});
