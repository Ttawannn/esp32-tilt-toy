import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const compiler = process.env.CXX || 'g++';
const msvc = /(?:^|[/\\])cl(?:\.exe)?$/i.test(compiler);
const probe = spawnSync(compiler, msvc ? [] : ['--version'], { windowsHide: true });

test('TFT water updates match a complete raster, erase old water and recover after overlays; OLED falls back', {
  skip: probe.error ? 'Set CXX to g++ / clang++ / cl' : false
}, async () => {
  const sketch = await readFile(new URL('../firmware/tilt_toy/tilt_toy.ino', import.meta.url), 'utf8');
  // Compile the actual sketch functions against a panel that records transferred pixels.
  const renderer = sketch.slice(sketch.indexOf('struct WaterView {'), sketch.indexOf('// Pixel Flow shades:'));
  const harness = await readFile(new URL('./motion/water_render_test.cpp', import.meta.url), 'utf8');
  const dir = resolve('work', 'water-render');
  await mkdir(dir, { recursive: true });
  const src = resolve(dir, 'water-render.cpp');
  await writeFile(src, harness.replace('/* SKETCH_RENDERER */', renderer));
  for (const profile of [0, 1, 2, 3, 4, 5]) {
    const exe = resolve(dir, process.platform === 'win32' ? `render-${profile}.exe` : `render-${profile}`);
    const includes = [resolve('tests/motion'), resolve('firmware/tilt_toy')];
    const args = msvc
      ? ['/nologo', '/std:c++17', '/EHsc', '/W4', `/DDISPLAY_PROFILE=${profile}`, ...includes.map(p => `/I${p}`), src, `/Fe:${exe}`, `/Fo:${resolve(dir, `render-${profile}.obj`)}`]
      : ['-std=c++17', '-Wall', '-Wextra', '-Werror', `-DDISPLAY_PROFILE=${profile}`, ...includes.map(p => `-I${p}`), src, '-o', exe];
    const build = spawnSync(compiler, args, { cwd: dir, encoding: 'utf8', windowsHide: true });
    assert.equal(build.status, 0, build.stdout + build.stderr);
    const run = spawnSync(exe, [], { encoding: 'utf8', windowsHide: true });
    assert.equal(run.status, 0, `profile ${profile}: ${run.stdout}${run.stderr}`);
  }
});
