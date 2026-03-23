// esbuild config for @anthropic-claude/agent-dashboard
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

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

// Copy dashboard static files
function copyDashboard() {
  const srcDir = 'src/dashboard';
  const destDir = 'dist/dashboard';

  if (!fs.existsSync(srcDir)) return;

  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile()) {
      fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
      console.log(`  ✓ Copied dashboard/${entry.name}`);
    }
  }
}

async function build() {
  await esbuild.build(serverConfig);
  console.log('✓ Server bundle built: dist/index.mjs');

  await esbuild.build(clientConfig);
  console.log('✓ Client bundle built: dist/client.mjs');

  copyDashboard();
  console.log('✓ Dashboard files copied');
}

build().catch(() => process.exit(1));
