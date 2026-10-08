import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const tests = (await readdir(resolve(root, 'tests')))
  .filter(name => name.endsWith('.test.mjs') && name !== 'releases.test.mjs')
  .sort().map(name => resolve(root, 'tests', name));
const result = spawnSync(process.execPath, ['--test', ...tests], {
  cwd: root, stdio: 'inherit', windowsHide: true
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
