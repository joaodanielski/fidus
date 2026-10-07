'use strict';

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8080;
const LAN = process.argv.includes('--lan');
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';

// Bare module names are not resolvable in browsers; the import map fixes that.
const importMap = JSON.stringify({
  imports: { 'libsodium-sumo': '/vendor/libsodium-sumo.mjs' },
});
const importMapHash = crypto
  .createHash('sha256')
  .update(importMap)
  .digest('base64');

const page = (title, script, extra) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script type="importmap">${importMap}</script>
</head>
<body>
<h1>${title}</h1>
<p>Fake password only. The page freezes while it runs.</p>
${extra}
<button id="run">Run</button>
<pre id="out"></pre>
<script type="module" src="${script}"></script>
</body>
</html>`;

const bigOption =
  '<label><input type="checkbox" id="big"> include 128 MiB (may crash weak devices)</label><br>';

const HTML = 'text/html; charset=utf-8';
const JS = 'text/javascript; charset=utf-8';
const WASM = 'application/wasm';

const modules = (...parts) => path.join(ROOT, 'node_modules', ...parts);
const sodiumFile = (pkg, file) =>
  modules(pkg, 'dist', 'modules-sumo-esm', file);

const routes = new Map([
  ['/', { type: HTML, body: page('Argon2id benchmark', '/bench.js', bigOption) }],
  ['/compare', { type: HTML, body: page('Argon2id comparison', '/compare.js', '') }],
  ['/bench.js', { type: JS, file: path.join(__dirname, 'bench.js') }],
  ['/compare.js', { type: JS, file: path.join(__dirname, 'compare.js') }],
  [
    '/vendor/libsodium-wrappers.mjs',
    { type: JS, file: sodiumFile('libsodium-wrappers-sumo', 'libsodium-wrappers.mjs') },
  ],
  [
    '/vendor/libsodium-sumo.mjs',
    { type: JS, file: sodiumFile('libsodium-sumo', 'libsodium-sumo.mjs') },
  ],
  ['/vendor/argon2id/setup.js', { type: JS, file: modules('argon2id', 'lib', 'setup.js') }],
  ['/vendor/argon2id/argon2id.js', { type: JS, file: modules('argon2id', 'lib', 'argon2id.js') }],
  ['/vendor/argon2id/blake2b.js', { type: JS, file: modules('argon2id', 'lib', 'blake2b.js') }],
  ['/vendor/argon2id/simd.wasm', { type: WASM, file: modules('argon2id', 'dist', 'simd.wasm') }],
  ['/vendor/argon2id/no-simd.wasm', { type: WASM, file: modules('argon2id', 'dist', 'no-simd.wasm') }],
]);

const csp = [
  "default-src 'none'",
  `script-src 'self' 'wasm-unsafe-eval' 'sha256-${importMapHash}'`,
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const server = http.createServer((req, res) => {
  const headers = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  };

  if (req.method !== 'GET') {
    res.writeHead(405, headers).end();
    return;
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  const route = routes.get(pathname);
  if (!route) {
    res.writeHead(404, headers).end('Not found');
    return;
  }

  const send = (body) => {
    res.writeHead(200, { ...headers, 'Content-Type': route.type });
    res.end(body);
  };

  if (route.body !== undefined) {
    send(route.body);
  } else {
    fs.readFile(route.file, (err, data) => {
      if (err) {
        res.writeHead(500, headers).end('Server error');
        return;
      }
      send(data);
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Listening on http://${HOST}:${PORT}`);
  if (LAN) {
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) {
          console.log(`Open on your phone: http://${a.address}:${PORT}/compare`);
        }
      }
    }
    console.log('LAN mode: trusted network only. Stop the server when done.');
  }
});