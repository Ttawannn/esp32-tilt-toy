import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const compiler = process.env.CXX || 'g++';
const msvc = /(?:^|[/\\])cl(?:\.exe)?$/i.test(compiler);
const probe = spawnSync(compiler, msvc ? [] : ['--version'], { windowsHide: true });

test('the toy rests after lying still, ignores sensor noise and small nudges, and wakes when picked up, turned or shaken', {
  skip: probe.error ? 'Set CXX to g++ / clang++ / cl' : false
}, async () => {
  const dir = resolve('work', 'rest');
  await mkdir(dir, { recursive: true });
  const exe = resolve(dir, process.platform === 'win32' ? 'rest.exe' : 'rest');
  const src = resolve('tests/motion/rest_test.cpp'), includes = [resolve('tests/motion'), resolve('firmware/tilt_toy')];
  const args = msvc
    ? ['/nologo', '/std:c++17', '/EHsc', '/W4', ...includes.map(p => `/I${p}`), src, `/Fe:${exe}`, `/Fo:${resolve(dir, 'rest.obj')}`]
    : ['-std=c++17', '-Wall', '-Wextra', '-Werror', ...includes.map(p => `-I${p}`), src, '-o', exe];
  const build = spawnSync(compiler, args, { cwd: dir, encoding: 'utf8', windowsHide: true });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const run = spawnSync(exe, [], { encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});
