/**
 * Bundle @concordium/verification-web-ui into a self-contained IIFE
 * that the browser can load via <script> tag.
 *
 * Output: public/build/verification-sdk.js  (+  .css)
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const outdir = path.resolve('public/build');
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [path.resolve('client/sdk-entry.js')],
  bundle: true,
  format: 'iife',
  sourcemap: true,
  minify: false,
  outfile: path.join(outdir, 'verification-sdk.js'),
  loader: {
    '.css': 'css',
    '.png': 'dataurl',
    '.svg': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.gif': 'dataurl',
    '.webp': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
  },
  metafile: true,
  logLevel: 'info',
});
