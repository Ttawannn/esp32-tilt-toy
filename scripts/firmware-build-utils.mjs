import { mkdir, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';

function integer(value, fallback, name, minimum = 1) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < minimum) {
    throw Error(`${name} must be an integer >= ${minimum}`);
  }
  return number;
}

export function buildConcurrency(env, boardCount, cpuCount) {
  const parallelBoards = Math.min(boardCount, integer(env.FIRMWARE_BOARD_CONCURRENCY,
    Math.min(2, Math.max(1, Math.floor(cpuCount / 4))), 'FIRMWARE_BOARD_CONCURRENCY'));
  const compileJobs = integer(env.FIRMWARE_JOBS,
    Math.min(12, Math.max(1, Math.floor(cpuCount / parallelBoards))), 'FIRMWARE_JOBS', 0);
  return { parallelBoards, compileJobs };
}

// Keep timestamps when a staged source is unchanged, so Arduino can reuse objects.
export async function writeIfChanged(path, source) {
  try {
    if (await readFile(path, 'utf8') === source) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await writeFile(path, source);
  return true;
}

export async function withBoardLock(boardWork, task) {
  await mkdir(boardWork, { recursive: true });
  const lock = join(boardWork, '.build-lock');
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw Error(`Build cache is locked: ${lock}. Another build may be using it. ` +
      'Use a different FIRMWARE_WORK_DIR, or remove the lock after verifying the previous build has stopped.');
  }
  const owner = join(lock, 'owner.json');
  try {
    await writeFile(owner, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }) + '\n');
    return await task();
  } finally {
    await unlink(owner).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await rmdir(lock);
  }
}

// Wait for started boards to finish even if one fails; do not start more boards.
export async function parallelBuilds(items, concurrency, task) {
  let next = 0, failure;
  async function worker() {
    while (!failure && next < items.length) {
      const item = items[next++];
      try { await task(item); } catch (error) { failure ??= error; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (failure) throw failure;
}
