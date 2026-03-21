// esbuild.config.mjs
// Dual esbuild configuration for extension host and webview

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

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
  plugins: [],
};

const webStandaloneConfig = {
  entryPoints: ['src/web/main.tsx'],
  bundle: true,
  outfile: 'dist/web/main.js',
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  sourcemap: true,
  plugins: [],
};

const webServerConfig = {
  entryPoints: ['src/web/server.ts'],
  bundle: true,
  outfile: 'dist/web/server.mjs',
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  external: ['vscode'],
};

// Copy assets from source to dist
function copyAssets() {
  const srcDir = 'assets/spritesheets';
  const destDir = 'dist/webview-assets';

  // Create dest directory
  fs.mkdirSync(destDir, { recursive: true });

  // Copy sprite assets
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);

    // Copy .png and .json files
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.json')) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✓ Copied ${file}`);
      }
    }
  } else {
    console.log('⚠ No assets/spritesheets directory - skipping asset copy');
  }

  // Copy font files from project root
  const rootFiles = fs.readdirSync('.');
  for (const file of rootFiles) {
    if (file.endsWith('.ttf')) {
      const srcPath = file;
      const destPath = path.join(destDir, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✓ Copied ${file}`);
    }
  }

  // Copy Nitro assets from assets/habbo/
  const habboDir = 'assets/habbo';
  if (fs.existsSync(habboDir)) {
    // Copy manifest
    const manifestPath = path.join(habboDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      fs.copyFileSync(manifestPath, path.join(destDir, 'manifest.json'));
      console.log('  ✓ Copied manifest.json');
    }

    // Copy furniture assets
    const furnitureSrc = path.join(habboDir, 'furniture');
    if (fs.existsSync(furnitureSrc)) {
      const furnitureDest = path.join(destDir, 'furniture');
      fs.mkdirSync(furnitureDest, { recursive: true });
      for (const file of fs.readdirSync(furnitureSrc)) {
        if (file.endsWith('.png') || file.endsWith('.json')) {
          fs.copyFileSync(path.join(furnitureSrc, file), path.join(furnitureDest, file));
          console.log(`  ✓ Copied furniture/${file}`);
        }
      }
    }

  } else {
    console.log('⚠ No assets/habbo directory - skipping Nitro asset copy (run download + convert scripts first)');
  }

  // Copy PixelLab character assets
  const pixellabSrc = 'assets/pixellab';
  if (fs.existsSync(pixellabSrc)) {
    const pixellabDest = path.join(destDir, 'pixellab');
    fs.mkdirSync(pixellabDest, { recursive: true });
    for (const file of fs.readdirSync(pixellabSrc)) {
      if (file.endsWith('.png') || file.endsWith('.json')) {
        fs.copyFileSync(path.join(pixellabSrc, file), path.join(pixellabDest, file));
        console.log(`  ✓ Copied pixellab/${file}`);
      }
    }
  }
}

// Copy assets to standalone web dist (symlinks to avoid duplication)
function copyWebAssets() {
  const webDir = 'dist/web';
  const assetsDir = path.join(webDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  // Copy index.html
  fs.copyFileSync('src/web/index.html', path.join(webDir, 'index.html'));
  console.log('  ✓ Copied index.html');

  // The webview-assets directory has everything we need — copy it into assets/
  const srcAssets = 'dist/webview-assets';
  if (!fs.existsSync(srcAssets)) {
    console.log('⚠ dist/webview-assets not found — run build:webview first');
    return;
  }

  function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyDirRecursive(srcAssets, assetsDir);
  console.log('  ✓ Copied webview-assets → dist/web/assets/');

  // Also copy sounds directory if it exists in source
  const soundsSrc = 'assets/sounds';
  if (fs.existsSync(soundsSrc)) {
    const soundsDest = path.join(assetsDir, 'sounds');
    fs.mkdirSync(soundsDest, { recursive: true });
    for (const file of fs.readdirSync(soundsSrc)) {
      fs.copyFileSync(path.join(soundsSrc, file), path.join(soundsDest, file));
    }
    console.log('  ✓ Copied sounds/');
  }
}

async function build() {
  const target = process.argv[2]; // 'extension' | 'webview' | 'web' | undefined (both ext+webview)

  if (!target || target === 'extension') {
    await esbuild.build(extensionConfig);
    console.log('✓ Extension built: dist/extension.cjs');
  }

  if (!target || target === 'webview') {
    // Copy assets before building webview
    copyAssets();

    await esbuild.build(webviewConfig);
    console.log('✓ Webview built: dist/webview.js');
  }

  if (target === 'web') {
    // Ensure webview assets exist first
    if (!fs.existsSync('dist/webview-assets')) {
      console.log('Building webview assets first...');
      copyAssets();
      await esbuild.build(webviewConfig);
      console.log('✓ Webview built: dist/webview.js');
    }

    // Build standalone web client
    await esbuild.build(webStandaloneConfig);
    console.log('✓ Standalone web built: dist/web/main.js');

    // Build server-side module (AgentManager wrapper)
    await esbuild.build(webServerConfig);
    console.log('✓ Web server module built: dist/web/server.mjs');

    // Copy web assets
    copyWebAssets();
    console.log('✓ Web assets copied to dist/web/');
  }
}

build().catch(() => process.exit(1));
