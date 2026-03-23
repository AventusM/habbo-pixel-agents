// esbuild config for @anthropic-claude/agent-dashboard
import * as esbuild from 'esbuild';

// Server-side bundle (Node, ESM)
const serverConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.mjs',
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  external: ['vscode'],
};

// Browser-side bundle (WebSocket client)
const clientConfig = {
  entryPoints: ['src/client.ts'],
  bundle: true,
  outfile: 'dist/client.mjs',
  platform: 'browser',
  format: 'esm',
  sourcemap: true,
};

async function build() {
  await esbuild.build(serverConfig);
  console.log('✓ Server bundle built: dist/index.mjs');

  await esbuild.build(clientConfig);
  console.log('✓ Client bundle built: dist/client.mjs');
}

build().catch(() => process.exit(1));
