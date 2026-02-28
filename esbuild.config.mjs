// esbuild.config.mjs
// Dual esbuild configuration for extension host and webview

import * as esbuild from 'esbuild';

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.cjs',
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  sourcemap: true,
};

const webviewConfig = {
  entryPoints: ['src/webview.tsx'],
  bundle: true,
  outfile: 'dist/webview.js',
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  sourcemap: true,
  // Asset copy plugin will be added here in Plan 03-03
  plugins: [],
};

async function build() {
  const target = process.argv[2]; // 'extension' | 'webview' | undefined (both)

  if (!target || target === 'extension') {
    await esbuild.build(extensionConfig);
    console.log('✓ Extension built: dist/extension.cjs');
  }

  if (!target || target === 'webview') {
    await esbuild.build(webviewConfig);
    console.log('✓ Webview built: dist/webview.js');
  }
}

build().catch(() => process.exit(1));
