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

    // Copy figure assets
    const figuresSrc = path.join(habboDir, 'figures');
    if (fs.existsSync(figuresSrc)) {
      const figuresDest = path.join(destDir, 'figures');
      fs.mkdirSync(figuresDest, { recursive: true });
      for (const file of fs.readdirSync(figuresSrc)) {
        if (file.endsWith('.png') || file.endsWith('.json')) {
          fs.copyFileSync(path.join(figuresSrc, file), path.join(figuresDest, file));
          console.log(`  ✓ Copied figures/${file}`);
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

async function build() {
  const target = process.argv[2]; // 'extension' | 'webview' | undefined (both)

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
}

build().catch(() => process.exit(1));
