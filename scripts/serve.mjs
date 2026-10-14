import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
// Serve the live sources in web/, so the page works without a build and edits show on reload.
// Generated files come from dist/ (npm run build): the bundled installer in /assets and the Arduino IDE
// sketches in /arduino. Without them the page still runs and explains what is unavailable.
const web = resolve(import.meta.dirname, '..', 'web');
const generated = ['assets', 'arduino'].map(dir => [`/${dir}/`, resolve(import.meta.dirname, '..', 'dist', dir)]);
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.ino': 'text/plain; charset=utf-8' };
const inside = (root, file) => file === root || file.startsWith(root + sep);
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const [prefix, root] = generated.find(([prefix]) => pathname.startsWith(prefix)) || ['/', web];
    let file = resolve(root, '.' + pathname.slice(prefix.length - 1));
    if (!inside(root, file)) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Permissions-Policy': 'serial=(self)' });
    res.end(data);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://localhost:${port}`));
