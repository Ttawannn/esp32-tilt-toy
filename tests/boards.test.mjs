import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { boards, defaultBoard, findBoard, releasePath } from '../web/boards.js';
import { profiles } from '../web/profiles.js';

test('board selection preserves the C6 default and gives every chip its own release URL', () => {
  assert.equal(findBoard('unknown'), defaultBoard);
  assert.equal(findBoard(undefined), defaultBoard);
  const paths = boards.flatMap(board => profiles.map(profile => releasePath(profile, board)));
  assert.equal(new Set(paths).size, 18);
  assert.equal(releasePath(profiles[0]), profiles[0].id);
});

const compiler = process.env.CXX || 'g++';
const msvc = /(?:^|[/\\])cl(?:\.exe)?$/i.test(compiler);
const probe = spawnSync(compiler, msvc ? [] : ['--version'], { windowsHide: true });
test('Arduino targets select matching GPIO profiles and reject an incompatible board', { skip: probe.error ? 'Set CXX to a host C++ compiler (g++ / clang++ / cl)' : false }, async () => {
  const directory = resolve('work', 'board-test');
  await mkdir(directory, { recursive: true });
  const source = resolve('tests', 'motion', 'board_config_test.cpp');
  const build = (board, explicitProfile) => {
    const executable = resolve(directory, board.id + (process.platform === 'win32' ? '.exe' : ''));
    const definitions = [`CONFIG_IDF_TARGET_${board.target.toUpperCase()}=1`, ...(explicitProfile === undefined ? [] : [`BOARD_PROFILE=${explicitProfile}`])];
    const args = msvc
      ? ['/nologo', '/std:c++17', '/EHsc', '/W4', ...definitions.map(d => `/D${d}`), source, `/Fe:${executable}`, `/Fo:${resolve(directory, board.id + '.obj')}`]
      : ['-std=c++17', '-Wall', '-Wextra', '-Werror', ...definitions.map(d => `-D${d}`), source, '-o', executable];
    return { executable, result: spawnSync(compiler, args, { cwd: directory, windowsHide: true, encoding: 'utf8' }) };
  };
  for (const board of boards) {
    for (const explicitProfile of [undefined, board.firmwareId]) {
      const { executable, result } = build(board, explicitProfile);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const run = spawnSync(executable, [], { windowsHide: true, encoding: 'utf8' });
      assert.equal(run.status, 0, run.stdout + run.stderr);
      assert.deepEqual(run.stdout.trim().split(/\r?\n/), [board.id, board.chipFamily, board.firmwareId, ...Object.values(board.pins)].map(String));
    }
    const otherBoard = boards.find(b => b.id !== board.id);
    const { result } = build(board, otherBoard.firmwareId);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /requires the ESP32/);
  }
});
