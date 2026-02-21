import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const outdir = path.resolve('public/build');
mkdirSync(outdir, { recursive: true });

// Bundle public/js/verify.js into an IIFE so that bare npm specifiers
// like @walletconnect/sign-client are resolved by esbuild at build time.
// The browser loads the self-contained bundle - no bare specifiers to trip over.
await build({
  entryPoints: [path.resolve('public/js/verify.js')],
  bundle: true,
  format: 'iife',
  sourcemap: true,
  minify: false,
  outfile: path.join(outdir, 'verify.js'),
  loader: {
    '.css': 'css',
    '.png': 'dataurl',
    '.svg': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.gif': 'dataurl',
    '.webp': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl'
  },
  metafile: true,
  logLevel: 'info',
});
