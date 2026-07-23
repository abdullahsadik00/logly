// Builds the tracking SDK: minifies sdk/logly.js -> public/sdk/logly.min.js
// and copies the readable source to public/sdk/logly.js for debugging.
// Run with: npm run build:sdk
import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'sdk/logly.js');
const outMin = resolve(root, 'public/sdk/logly.min.js');
const outSrc = resolve(root, 'public/sdk/logly.js');

mkdirSync(dirname(outMin), { recursive: true });

await build({
  entryPoints: [src],
  outfile: outMin,
  minify: true,
  bundle: true,
  target: ['es2018'],
  legalComments: 'inline', // keep the /*! ... */ privacy/usage banner
  logLevel: 'info',
});

copyFileSync(src, outSrc);
console.log('[build:sdk] wrote public/sdk/logly.min.js and public/sdk/logly.js');
