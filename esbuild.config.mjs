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

function generatePreviewHtml() {
  const assets = 'webview-assets';
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Habbo Pixel Agents — Preview</title>
    <style>
      @font-face {
        font-family: 'Press Start 2P';
        src: url('./${assets}/PressStart2P-Regular.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: block;
      }
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100vh; background: #1a1a2e; }
    </style>
    <script>
      window.ASSET_URIS = {
        chairPng: './${assets}/chair_atlas.png',
        chairJson: './${assets}/chair_atlas.json',
        furniturePng: './${assets}/furniture_atlas.png',
        furnitureJson: './${assets}/furniture_atlas.json',
        avatarPng: './${assets}/avatar_atlas.png',
        avatarJson: './${assets}/avatar_atlas.json',
        notificationSound: './${assets}/sounds/notification.wav',
        nitroManifest: './${assets}/manifest.json',
        nitroFurnitureBase: './${assets}/furniture',
        pixellabPng: './${assets}/pixellab/beanie-hoodie-guy.png',
        pixellabJson: './${assets}/pixellab/beanie-hoodie-guy.json',
        plPlanningPng: './${assets}/pixellab/pl-planning.png',
        plPlanningJson: './${assets}/pixellab/pl-planning.json',
        plCoreDevPng: './${assets}/pixellab/pl-core-dev.png',
        plCoreDevJson: './${assets}/pixellab/pl-core-dev.json',
        plInfrastructurePng: './${assets}/pixellab/pl-infrastructure.png',
        plInfrastructureJson: './${assets}/pixellab/pl-infrastructure.json',
        plSupportPng: './${assets}/pixellab/pl-support.png',
        plSupportJson: './${assets}/pixellab/pl-support.json',
      };
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script src="./webview.js"></script>
  </body>
</html>`;

  fs.writeFileSync(path.join('dist', 'preview.html'), html, 'utf8');
  console.log('✓ Preview HTML generated: dist/preview.html');
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

    generatePreviewHtml();
  }
}

build().catch(() => process.exit(1));
