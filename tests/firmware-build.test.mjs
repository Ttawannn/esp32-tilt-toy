import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, utimes, rm, access } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { buildConcurrency, writeIfChanged, withBoardLock, parallelBuilds } from '../scripts/firmware-build-utils.mjs';

async function directory(t) {
  const work = resolve('work');
  await mkdir(work, { recursive: true });
  const path = await mkdtemp(join(work, 'firmware-build-test-'));
  t.after(async () => {
    assert.ok(path.startsWith(work + sep));
    await rm(path, { recursive: true, force: true });
  });
  return path;
}

test('automatic build concurrency shares CPU capacity across boards', () => {
  assert.deepEqual(buildConcurrency({}, 3, 16), { parallelBoards: 2, compileJobs: 8 });
  assert.deepEqual(buildConcurrency({}, 1, 16), { parallelBoards: 1, compileJobs: 12 });
  assert.deepEqual(buildConcurrency({}, 3, 2), { parallelBoards: 1, compileJobs: 2 });
});

test('explicit concurrency permits serial builds and Arduino auto jobs, rejecting invalid settings', () => {
  assert.deepEqual(buildConcurrency({ FIRMWARE_BOARD_CONCURRENCY: '1', FIRMWARE_JOBS: '8' }, 3, 16),
    { parallelBoards: 1, compileJobs: 8 });
  assert.deepEqual(buildConcurrency({ FIRMWARE_JOBS: '0' }, 1, 16), { parallelBoards: 1, compileJobs: 0 });
  for (const name of ['FIRMWARE_BOARD_CONCURRENCY', 'FIRMWARE_JOBS']) {
    for (const value of ['', '-1', '2x', '1.5', '9007199254740992']) {
      assert.throws(() => buildConcurrency({ [name]: value }, 3, 16), new RegExp(name));
    }
  }
  assert.throws(() => buildConcurrency({ FIRMWARE_BOARD_CONCURRENCY: '0' }, 3, 16));
});

test('unchanged staging retains timestamps while changed headers are written', async t => {
  const path = join(await directory(t), 'config.h');
  assert.equal(await writeIfChanged(path, 'profile 0\n'), true);
  const old = new Date('2020-01-01T00:00:00Z');
  await utimes(path, old, old);
  const before = await stat(path);
  assert.equal(await writeIfChanged(path, 'profile 0\n'), false);
  assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
  assert.equal(await writeIfChanged(path, 'profile 1\n'), true);
  assert.equal(await readFile(path, 'utf8'), 'profile 1\n');
});

test('a board lock rejects a competing writer and becomes reusable after success', async t => {
  const path = await directory(t);
  let ready, release;
  const entered = new Promise(resolve => { ready = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const first = withBoardLock(path, async () => { ready(); await gate; return 'built'; });
  await entered;
  try {
    assert.equal(JSON.parse(await readFile(join(path, '.build-lock', 'owner.json'))).pid, process.pid);
    await assert.rejects(withBoardLock(path, () => assert.fail('competing writer must not run')), /cache is locked/);
  } finally { release(); }
  assert.equal(await first, 'built');
  assert.equal(await withBoardLock(path, () => 'next build'), 'next build');
  await assert.rejects(access(join(path, '.build-lock')), { code: 'ENOENT' });
});

test('failed compilation releases its board lock', async t => {
  const path = await directory(t);
  await assert.rejects(withBoardLock(path, () => { throw Error('compile failed'); }), /compile failed/);
  assert.equal(await withBoardLock(path, () => 'retry'), 'retry');
});

test('board workers overlap but never exceed the configured concurrency', async () => {
  let active = 0, maximum = 0;
  const finished = [];
  await parallelBuilds([1, 2, 3, 4, 5], 2, async value => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setImmediate(resolve));
    finished.push(value);
    active--;
  });
  assert.equal(maximum, 2);
  assert.equal(active, 0);
  assert.deepEqual(finished.sort(), [1, 2, 3, 4, 5]);
});

test('a failed board stops queued work and waits for the other active board', async () => {
  let failFirst, finishSecond;
  const first = new Promise(resolve => { failFirst = resolve; });
  const second = new Promise(resolve => { finishSecond = resolve; });
  const started = [];
  let secondFinished = false;
  const running = parallelBuilds([1, 2, 3], 2, async value => {
    started.push(value);
    if (value === 1) { await first; throw Error('board 1 failed'); }
    await second;
    secondFinished = true;
  });
  failFirst();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [1, 2]);
  assert.equal(secondFinished, false);
  finishSecond();
  await assert.rejects(running, /board 1 failed/);
  assert.equal(secondFinished, true);
  assert.deepEqual(started, [1, 2]);
});
