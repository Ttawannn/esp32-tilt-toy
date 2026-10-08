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
let flashAdapterResolved = false;
await build({
  entryPoints: [resolve(root, 'web/installer.js')], bundle: true, minify: true,
  format: 'esm', target: 'es2022', outfile: resolve(out, 'assets/installer.js'), legalComments: 'linked',
  plugins: [{
    name: 'tilt-installer',
    setup(bundler) {
      // ESP Web Tools' unbundled entry uses pre-build Material style names.
      // The published Material package calls these modules *.cssresult.js.
      bundler.onResolve({ filter: /^@material\/web\/.+-styles\.js$/ }, args => ({ path: resolve(root, 'node_modules', args.path.replace(/\.js$/, '.cssresult.js')) }));
      bundler.onResolve({ filter: /^\.\/flash$/ }, args => {
        if (args.importer.replaceAll('\\', '/').endsWith('/esp-web-tools/dist/install-dialog.js')) {
          flashAdapterResolved = true;
          return { path: resolve(root, 'web/installer-flash.js') };
        }
      });
      // The page and installer must share the same language state at runtime.
      bundler.onResolve({ filter: /^\.\/i18n\.js$/ }, args => {
        if (args.importer === resolve(root, 'web/installer.js')) return { path: '../i18n.js', external: true };
      });
      bundler.onEnd(() => flashAdapterResolved ? undefined : { errors: [{ text: 'ESP Web Tools flash hook changed; update the installer adapter before publishing.' }] });
    }
  }]
});
for (const file of await readdir(resolve(out, 'firmware'), { recursive: true })) {
  if (file.endsWith('.json')) JSON.parse(await readFile(resolve(out, 'firmware', file), 'utf8'));
}
console.log('Built dist/ with bundled ESP Web Tools.');
