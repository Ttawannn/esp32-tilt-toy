import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
// Check browser imports before replacing the files served by localhost.
// The installer module is generated separately below.
await build({ entryPoints: [resolve(root, 'web', 'app.js')], bundle: true, write: false, format: 'esm', target: 'es2022', external: ['./assets/installer.js'], logLevel: 'silent' });
// Only the known generated output directory may be replaced.
if (out !== resolve(root, 'dist')) throw new Error('Invalid output path');
await rm(out, { recursive: true, force: true });
await mkdir(resolve(out, 'assets'), { recursive: true });
await cp(resolve(root, 'web'), out, { recursive: true });
await build({ stdin: { contents: 'import "esp-web-tools/dist/web/install-button.js";', resolveDir: root, sourcefile: 'installer.js' }, bundle: true, minify: true, format: 'esm', target: 'es2022', outfile: resolve(out, 'assets/installer.js'), legalComments: 'linked' });
for (const file of await readdir(resolve(out, 'firmware'))) {
  if (file.endsWith('.json')) JSON.parse(await readFile(resolve(out, 'firmware', file), 'utf8'));
}
console.log('Built dist/ with bundled ESP Web Tools.');
