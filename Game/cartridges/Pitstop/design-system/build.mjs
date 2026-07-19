#!/usr/bin/env node
/* ============================================================================
 * @pitstop/ui — build
 * ----------------------------------------------------------------------------
 * Two artifacts, deliberately:
 *
 *   dist/index.js      ESM bundle of the React components. React stays EXTERNAL
 *                      so a consumer (and the Claude Design runtime) supplies
 *                      its own copy — bundling a second React is the classic way
 *                      to get two renderers and hooks that throw.
 *   dist/ps-ui.css    ONE flat stylesheet, every @import already inlined.
 *
 * That second artifact is the point of the whole package. Pitstop has NO build
 * system (see Game/CLAUDE.md) — it is plain HTML that can only `<link>` a
 * stylesheet. Emitting the components' real CSS as a plain file is
 * what lets Pitstop eventually consume the SAME styles the components are
 * verified against, instead of keeping a hand-copied fork that drifts. Anything
 * that breaks that (CSS modules, hashed class names, CSS-in-JS) would sever it,
 * which is why this package styles by plain semantic class name and nothing else.
 *
 * Types are emitted separately by `tsc --emitDeclarationOnly` (see npm run
 * types) — esbuild deliberately does not typecheck, so the two steps stay
 * independent and a type error can never silently ship.
 * ========================================================================= */
import * as esbuild from 'esbuild';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, 'dist');

// A stale dist is worse than none: a component deleted from src would otherwise
// linger in dist and keep getting synced.
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const shared = {
  bundle: true,
  format: 'esm',
  target: ['es2020', 'chrome100', 'firefox100', 'safari15'],
  logLevel: 'info',
  absWorkingDir: root,
};

// --- 1. the component bundle -------------------------------------------------
await esbuild.build({
  ...shared,
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(outdir, 'index.js'),
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  jsx: 'automatic',
  // The components import './styles/index.css' for authoring ergonomics, but the
  // bundle must NOT carry it: consumers link dist/ps-ui.css themselves (built
  // below), and injecting the same rules twice from two places makes cascade
  // bugs that only appear in one of the two consumers.
  loader: { '.css': 'empty' },
});

// --- 2. the flat stylesheet --------------------------------------------------
await esbuild.build({
  ...shared,
  entryPoints: [resolve(root, 'src/styles/index.css')],
  outfile: resolve(outdir, 'ps-ui.css'),
  loader: { '.woff2': 'file', '.woff': 'file', '.png': 'file', '.svg': 'file' },
  // 'fonts/[name]' (not the default hashed 'assets/[name]-HASH') so dist mirrors
  // the layout the design bundle expects, and so a cartridge linking the CSS gets
  // a stable, human-readable path it can copy alongside it.
  assetNames: 'fonts/[name]',
});

if (!existsSync(resolve(outdir, 'index.js')) || !existsSync(resolve(outdir, 'ps-ui.css'))) {
  console.error('build: expected artifacts missing from dist/');
  process.exit(1);
}
console.log('build: dist/index.js + dist/ps-ui.css');
