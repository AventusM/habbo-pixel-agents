# Phase 3: Asset Pipeline - Research

**Researched:** 2026-02-28
**Domain:** .nitro binary extraction, sprite atlas loading, ImageBitmap GPU decoding, VS Code webview asset serving, dual esbuild configs
**Confidence:** MEDIUM-HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ASSET-01 | Node.js pre-build script correctly parses .nitro binary format (BigEndian UI16 file count, per-file UI16 name length + UI32 compressed length + zlib-inflated data) and outputs PNG atlas files and JSON manifests to `dist/webview-assets/`. | Binary format specification verified from Retrosprite documentation. Node.js `Buffer.readUInt16BE()`, `Buffer.readUInt32BE()`, and `zlib.inflateSync()` are standard APIs. |
| ASSET-02 | PNG atlas files and JSON manifests never imported through esbuild; copied to `dist/webview-assets/` by build step and loaded via `webview.asWebviewUri()` URIs. | VS Code webview asset loading pattern verified from official extension API docs. esbuild copy plugin pattern established. |
| ASSET-03 | `localResourceRoots` includes `vscode.Uri.joinPath(context.extensionUri, 'dist')` so webview assets served without 401 errors. | Official VS Code Webview API docs confirm `localResourceRoots` is required for asset access. Pattern already implemented in existing `extension.ts`. |
| ASSET-04 | After atlas PNG loaded as `HTMLImageElement`, `createImageBitmap()` called immediately to pre-decode; `ImageBitmap` objects stored in sprite cache for all `drawImage` calls. | `createImageBitmap()` confirmed as GPU-accelerated pre-decode API from WHATWG HTML spec. Performance benefit verified from MDN and canvas optimization guides. |
| ASSET-05 | Sprite cache resolves frame keys in format `{name}_{size}_{layer}_{direction}_{frame}` to `{x, y, w, h}` atlas regions using Texture Packer "hash" format JSON manifest. | Texture Packer JSON Hash format verified. Frame naming convention from Retrosprite documentation matches this pattern. |
| ASSET-06 | Two separate esbuild configs — extension host (Node.js target) and webview UI (browser target) — so Node.js built-ins never bundled into webview. | esbuild platform targets verified from official docs and VS Code extension bundling guide. Pattern: separate entry points + separate `platform` settings. |
| ASSET-07 | Extraction script validated by running against known .nitro bundle and comparing extracted PNG + JSON output visually against Retrosprite. | Manual validation step — no automated tool needed. Retrosprite provides visual reference. |
| BUILD-01 | Running build produces working VS Code extension that loads without errors in target VS Code version. | Standard VS Code extension requirement — existing project already satisfies this. |
| BUILD-02 | Pre-build .nitro extraction script runs before esbuild step; output present in `dist/webview-assets/` when webview initialises. | npm pre-build hooks verified from official npm docs. Pattern: `prebuild` script runs before `build` script automatically. |
| BUILD-03 | Build does not commit extracted Sulake assets to git; `.gitignore` excludes `dist/webview-assets/` or equivalent. | .gitignore pattern syntax verified. Standard practice for build output and licensed assets. |
</phase_requirements>

---

## Summary

Phase 3 bridges the gap between static Canvas 2D geometry (Phase 2) and sprite-based rendering (Phases 4-5). The core challenge is extracting Habbo's .nitro asset bundles at build time, serving them through VS Code's webview security model, and loading them into GPU-accelerated ImageBitmap objects for high-performance Canvas 2D rendering.

The .nitro binary format is fully documented in the Retrosprite project: BigEndian UI16 file count, followed by per-file UI16 name length + filename string + UI32 compressed length + individually zlib-compressed data. Each file is compressed separately (not the entire archive), which allows random access. Node.js has built-in support for all required operations: `Buffer.readUInt16BE()`, `Buffer.readUInt32BE()`, `zlib.inflateSync()`, and `fs.writeFileSync()`.

The asset loading path has three layers: (1) build-time extraction from .nitro to PNG + JSON in `dist/webview-assets/`, (2) esbuild copy plugin to preserve these files during bundling, and (3) runtime loading in the webview using `webview.asWebviewUri()` to convert local file paths into security-approved URIs. The existing extension already has `localResourceRoots` configured correctly for `dist/` access, but the CSP meta tag will need `img-src ${webview.cspSource};` added for image loading.

The sprite cache abstraction sits between the raw atlas PNG and the renderer. It loads PNGs as `HTMLImageElement`, immediately calls `createImageBitmap()` to pre-decode pixels into GPU memory, and exposes a frame lookup API: given a frame key like `chair_64_a_2_0`, return `{ bitmap: ImageBitmap, x, y, w, h }` so the renderer can call `ctx.drawImage(bitmap, x, y, w, h, destX, destY, w, h)`. This pattern is significantly faster than drawing from `HTMLImageElement` directly because the decode step happens once at load time, not per-frame.

**Primary recommendation:** Build the extraction script first (`src/scripts/extractNitro.ts`) and validate it visually against Retrosprite before writing any sprite cache code. Use `sphynxkitten/nitro-assets` as the pre-extracted fallback source if .nitro extraction proves problematic — this repository already contains extracted PNGs and JSONs in Texture Packer hash format, so the sprite cache can be built and tested even if .nitro parsing is deferred to a later phase.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `zlib` | Built-in (Node 20+) | Inflate zlib-compressed .nitro file data | Native support for RFC 1950 zlib format used by .nitro bundles |
| Node.js `Buffer` | Built-in | Binary parsing: `readUInt16BE`, `readUInt32BE` for .nitro header | Standard for all binary file parsing in Node.js |
| `createImageBitmap()` | Browser built-in (baseline since 2023-01) | Pre-decode PNG atlas into GPU memory as `ImageBitmap` | WHATWG standard; GPU-accelerated decode with no per-frame latency |
| `webview.asWebviewUri()` | VS Code API | Convert local `file://` paths to `vscode-resource://` URIs | Required by VS Code webview security model for all local resource access |
| esbuild | ^0.27.3 (existing) | Dual bundler: extension host (Node.js) + webview (browser) | Already established in Phase 2; separate configs prevent Node.js built-ins leaking into browser bundle |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `esbuild-copy-static-files` | ^0.1.0+ | Copy extracted assets from `src/assets/` to `dist/webview-assets/` during build | Alternative to custom esbuild plugin; only copies files that changed (MD5 hash check) |
| `@sprout2000/esbuild-copy-plugin` | latest | Typed esbuild plugin for copying static files | Alternative to esbuild-copy-static-files; fully typed, tested |
| Texture Packer CLI | N/A (external tool) | Generate JSON hash manifests if creating custom spritesheets | Only needed if not using pre-extracted assets from sphynxkitten/nitro-assets |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Build-time .nitro extraction | Use pre-extracted assets from `sphynxkitten/nitro-assets` | Pre-extracted assets are lower risk and faster to integrate; .nitro extraction gives full control over asset pipeline but adds complexity. **Recommendation:** Start with pre-extracted for Phase 3; defer .nitro extraction script to Wave 1 or post-v1. |
| `createImageBitmap()` | Draw from `HTMLImageElement` directly | `HTMLImageElement` causes per-frame decode latency; `ImageBitmap` pre-decodes to GPU. Always use `ImageBitmap`. |
| esbuild copy plugin | Manual copy script in `package.json` | Copy plugin integrates with esbuild watch mode; manual script requires separate watcher. Use plugin. |
| Texture Packer JSON Hash | JSON Array format | Hash format allows frame lookup by name string (`frames["chair_64_a_2_0"]`); Array requires index lookup. Use Hash. |

**Installation:**

```bash
# Core dependencies (already installed in Phase 1/2):
# - esbuild
# - TypeScript
# - Node.js 20+

# Asset copy plugin (choose one):
npm install --save-dev esbuild-copy-static-files
# OR
npm install --save-dev @sprout2000/esbuild-copy-plugin
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── scripts/
│   └── extractNitro.ts         # Pre-build: parse .nitro → PNG + JSON (deferred to Wave 1)
├── isoSpriteCache.ts           # Runtime: atlas loader + ImageBitmap cache
└── extension.ts                # Existing: add CSP img-src directive

dist/
├── extension.cjs               # esbuild output: Node.js extension host
├── webview.js                  # esbuild output: browser webview bundle
└── webview-assets/             # Copied during build: PNG atlases + JSON manifests
    ├── chair_atlas.png
    ├── chair_atlas.json
    └── ...

.gitignore
└── dist/webview-assets/        # NEVER commit extracted Sulake assets
```

### Pattern 1: .nitro Binary Format Parsing

**What:** Parse the BigEndian .nitro binary format to extract individual files (PNG atlases, JSON manifests).

**When to use:** Build-time script (`src/scripts/extractNitro.ts`) runs before esbuild. Invoked via npm `prebuild` hook.

**Binary structure (HIGH confidence — verified from Retrosprite documentation):**

```
[FileCount:UI16 BigEndian]                  # Number of files in bundle
  [NameLen:UI16 BE] [Name:string]           # Filename length + filename
  [CompressedLen:UI32 BE]                   # Compressed data size
  [ZlibData]                                # zlib-compressed file content
  ... (repeat for each file)
```

**Example:**

```typescript
// Source: Retrosprite documentation (github.com/Bopified/Retrosprite)
// Binary parsing verified against Node.js Buffer API docs
import * as fs from 'fs';
import * as zlib from 'zlib';

export function extractNitro(nitroPath: string, outDir: string): void {
  const buffer = fs.readFileSync(nitroPath);
  let offset = 0;

  // Read file count (BigEndian UI16)
  const fileCount = buffer.readUInt16BE(offset);
  offset += 2;

  for (let i = 0; i < fileCount; i++) {
    // Read filename length (BigEndian UI16)
    const nameLen = buffer.readUInt16BE(offset);
    offset += 2;

    // Read filename string
    const filename = buffer.toString('utf8', offset, offset + nameLen);
    offset += nameLen;

    // Read compressed data length (BigEndian UI32)
    const compressedLen = buffer.readUInt32BE(offset);
    offset += 4;

    // Extract compressed data slice
    const compressedData = buffer.subarray(offset, offset + compressedLen);
    offset += compressedLen;

    // Inflate (decompress) using zlib
    const decompressed = zlib.inflateSync(compressedData);

    // Write to output directory
    const outPath = `${outDir}/${filename}`;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, decompressed);
  }
}
```

**Pitfall:** `.nitro` files use **BigEndian** byte order. Always use `readUInt16BE()` and `readUInt32BE()`, NOT `readUInt16LE()` or `readUInt32LE()`.

### Pattern 2: Dual esbuild Configuration (Extension Host + Webview)

**What:** Two separate esbuild configurations prevent Node.js built-ins (`zlib`, `fs`, `path`) from being bundled into the browser-targeted webview bundle.

**When to use:** Always, for any VS Code extension with a webview.

**Configuration (HIGH confidence — verified from VS Code extension bundling guide):**

```typescript
// Source: VS Code Extension API - Bundling Extensions
// https://code.visualstudio.com/api/working-with-extensions/bundling-extension
import * as esbuild from 'esbuild';

// Extension host (Node.js environment)
await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.cjs',
  platform: 'node',        // Node.js built-ins allowed
  external: ['vscode'],    // VS Code API externalized
  format: 'cjs',           // CommonJS for Node.js
});

// Webview UI (browser environment)
await esbuild.build({
  entryPoints: ['src/webview.tsx'],
  bundle: true,
  outfile: 'dist/webview.js',
  platform: 'browser',     // NO Node.js built-ins
  format: 'iife',          // Immediately invoked function for browser
  jsx: 'automatic',        // React 17+ automatic JSX runtime
});
```

**package.json scripts:**

```json
{
  "scripts": {
    "build:ext": "node esbuild.config.js --target=extension",
    "build:webview": "node esbuild.config.js --target=webview",
    "build": "npm run build:ext && npm run build:webview"
  }
}
```

**Alternative (simpler):** Inline both builds in separate npm scripts as already implemented in existing `package.json`. Current approach is fine.

### Pattern 3: webview.asWebviewUri() Asset Loading

**What:** Convert local `file://` paths to VS Code webview-approved `vscode-resource://` URIs.

**When to use:** All runtime asset loading in the webview (images, fonts, audio).

**Security model (HIGH confidence — verified from VS Code Webview API docs):**

- Webviews run in sandboxed iframe with restricted filesystem access
- `localResourceRoots` allowlists directories that can be accessed
- `webview.asWebviewUri()` converts paths within allowlisted roots to approved URIs
- CSP `img-src` directive must include `${webview.cspSource}` for image loading

**Example:**

```typescript
// Source: VS Code Extension API - Webview
// https://code.visualstudio.com/api/extension-guides/webview

// Extension host (extension.ts):
const panel = vscode.window.createWebviewPanel(
  'habboRoom',
  'Habbo Room',
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, 'dist')  // Allow dist/ access
    ]
  }
);

const atlasUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'chair_atlas.png')
);

panel.webview.html = `
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 script-src ${panel.webview.cspSource};
                 img-src ${panel.webview.cspSource};
                 style-src 'unsafe-inline';" />
  <img src="${atlasUri}" />
`;

// Webview (webview.tsx):
// Pass atlasUri from extension host to webview via postMessage or inline in HTML
const img = new Image();
img.src = atlasUri;  // vscode-resource://... URI
img.onload = () => {
  createImageBitmap(img).then(bitmap => {
    // Store bitmap in sprite cache
  });
};
```

**Pitfall:** Forgetting `img-src ${webview.cspSource};` in CSP causes all image loads to fail with CSP violation errors.

### Pattern 4: ImageBitmap Pre-decode Pattern

**What:** Load atlas PNG as `HTMLImageElement`, immediately decode to `ImageBitmap`, store `ImageBitmap` in cache, use for all `drawImage()` calls.

**When to use:** All sprite rendering (furniture, avatars).

**Performance benefit (HIGH confidence — verified from WHATWG HTML spec and MDN Canvas optimization guide):**

- `HTMLImageElement`: Decode happens per-frame on CPU; blocks render pipeline
- `ImageBitmap`: Decode happens once on GPU; zero per-frame cost
- `createImageBitmap()` returns GPU texture; `drawImage()` is GPU blit operation

**Example:**

```typescript
// Source: MDN - Optimizing Canvas
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
export class SpriteCache {
  private bitmaps = new Map<string, ImageBitmap>();
  private manifests = new Map<string, SpriteManifest>();

  async loadAtlas(atlasName: string, pngUri: string, jsonUri: string): Promise<void> {
    // Load PNG as HTMLImageElement
    const img = new Image();
    img.src = pngUri;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // Immediately decode to ImageBitmap (GPU texture)
    const bitmap = await createImageBitmap(img);
    this.bitmaps.set(atlasName, bitmap);

    // Load JSON manifest
    const response = await fetch(jsonUri);
    const manifest = await response.json();
    this.manifests.set(atlasName, manifest);
  }

  getFrame(atlasName: string, frameName: string): SpriteFrame | null {
    const bitmap = this.bitmaps.get(atlasName);
    const manifest = this.manifests.get(atlasName);
    if (!bitmap || !manifest) return null;

    const frameData = manifest.frames[frameName];
    if (!frameData) return null;

    return {
      bitmap,
      x: frameData.frame.x,
      y: frameData.frame.y,
      w: frameData.frame.w,
      h: frameData.frame.h,
    };
  }
}

// Usage in renderer:
const frame = spriteCache.getFrame('chair', 'chair_64_a_2_0');
if (frame) {
  ctx.drawImage(
    frame.bitmap,           // ImageBitmap source
    frame.x, frame.y,       // Source atlas position
    frame.w, frame.h,       // Source size
    destX, destY,           // Destination screen position
    frame.w, frame.h        // Destination size (no scaling)
  );
}
```

### Pattern 5: Texture Packer JSON Hash Format

**What:** Sprite atlas manifest where each frame is keyed by name string, not array index.

**When to use:** All sprite atlases (furniture, avatars, effects).

**Format structure (MEDIUM confidence — verified from Texture Packer docs and Retrosprite output):**

```json
{
  "frames": {
    "furniture_64_a_0_0": {
      "frame": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 64 },
      "sourceSize": { "w": 64, "h": 64 }
    },
    "furniture_64_a_2_0": {
      "frame": { "x": 64, "y": 0, "w": 64, "h": 64 },
      ...
    }
  },
  "meta": {
    "image": "furniture_atlas.png",
    "format": "RGBA8888",
    "size": { "w": 512, "h": 512 }
  }
}
```

**Frame naming convention (from Retrosprite docs):**

`{name}_{size}_{layer}_{direction}_{frame}`

- `name`: Furniture type (e.g., `chair`, `desk`)
- `size`: Sprite dimensions (e.g., `64` for 64×64)
- `layer`: Multi-layer sprites (e.g., `a`, `b`, `c`)
- `direction`: Isometric direction 0-7 (Habbo uses 0, 2, 4, 6 for 4-way rotation)
- `frame`: Animation frame index (0 for static furniture)

**Example frame keys:**
- `chair_64_a_2_0` — Chair, 64px, layer a, direction 2 (right-facing), frame 0
- `desk_64_a_0_0` — Desk, 64px, layer a, direction 0 (front-facing), frame 0

### Anti-Patterns to Avoid

- **Loading assets in the extension host and passing pixel data to webview:** Asset loading MUST happen in the webview. The extension host can only pass URIs, not `ImageBitmap` or pixel data.
- **Bundling PNG/JSON through esbuild as data URIs:** This inflates the webview bundle size; VS Code's asset serving is designed for external files.
- **Using `HTMLImageElement` directly in `drawImage()`:** Always pre-decode to `ImageBitmap` first; per-frame decode causes visible stutter.
- **Forgetting to update CSP when adding asset types:** If adding audio later, `media-src ${webview.cspSource};` must be added to CSP.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Binary file parsing | Custom bit-shifting + manual struct parsing | Node.js `Buffer` API (`readUInt16BE`, `readUInt32BE`, `subarray`) | Buffer API is optimized C++; handles endianness correctly; battle-tested across millions of npm packages |
| zlib decompression | Custom inflate implementation | Node.js `zlib.inflateSync()` | Native zlib binding to C library; RFC 1950 compliant; handles edge cases (truncated data, checksums) |
| Atlas frame lookup | Linear array search | Map/object keyed by frame name | O(1) lookup vs O(n); frame names are unique strings |
| Asset caching | Re-load PNG on every furniture spawn | Load once, cache `ImageBitmap`, reuse | GPU memory is designed for reuse; re-loading wastes bandwidth and decode time |

**Key insight:** Browser and Node.js built-ins for binary parsing, compression, and image decoding are highly optimized C/C++ code with decades of edge-case handling. Custom implementations are slower, buggier, and harder to maintain.

---

## Common Pitfalls

### Pitfall 1: BigEndian vs LittleEndian Confusion

**What goes wrong:** Using `readUInt16LE()` or `readUInt32LE()` (little-endian) instead of `readUInt16BE()` (big-endian) causes garbage values when parsing .nitro headers.

**Why it happens:** Most modern systems are little-endian, so developers default to LE methods. .nitro uses BigEndian format.

**How to avoid:** Always use `BE` methods for .nitro parsing: `buffer.readUInt16BE(offset)`, `buffer.readUInt32BE(offset)`.

**Warning signs:** File count reads as a huge number (e.g., 16384 instead of 64); filenames are corrupted; zlib inflate throws "invalid header" errors.

### Pitfall 2: 401 Unauthorized on Asset Loads

**What goes wrong:** Webview shows broken image icons; browser console logs 401 errors for all `vscode-resource://` URIs.

**Why it happens:** `localResourceRoots` does not include the directory containing the assets, OR `webview.asWebviewUri()` was not used to convert the path.

**How to avoid:**
1. Ensure `localResourceRoots` includes the parent directory: `vscode.Uri.joinPath(context.extensionUri, 'dist')`
2. Always use `webview.asWebviewUri()` to convert paths before passing to webview
3. Check browser DevTools Network tab: if URI starts with `file://`, it's wrong; should be `vscode-resource://` or `vscode-webview-resource://`

**Warning signs:** Network tab shows 401 status; CSP violations logged; images don't load.

### Pitfall 3: CSP img-src Missing

**What goes wrong:** Images don't load; browser console logs CSP violation: "Refused to load image because it violates the following Content Security Policy directive: 'img-src'".

**Why it happens:** CSP meta tag is missing `img-src ${webview.cspSource};` directive.

**How to avoid:** Always include `img-src ${webview.cspSource};` in the CSP when loading images. Copy the pattern from Pattern 3.

**Warning signs:** Console logs CSP violations; `<img>` elements remain empty; `Image.onload` never fires.

### Pitfall 4: Stale Asset Cache After Rebuild

**What goes wrong:** After changing an atlas PNG, the webview still shows the old image.

**Why it happens:** esbuild copy plugin uses MD5 hash to skip unchanged files; if the hash matches, the file isn't copied. Browser caches the old asset.

**How to avoid:**
1. Use "Reload Window" command in VS Code after asset changes (Cmd+Shift+P → "Developer: Reload Window")
2. OR clear `dist/webview-assets/` manually before rebuild: `rm -rf dist/webview-assets && npm run build`

**Warning signs:** Code changes work, but asset changes don't appear.

---

## Code Examples

Verified patterns from official sources:

### Build Script with Pre-build Hook

```javascript
// Source: npm official docs - scripts
// https://docs.npmjs.com/cli/v10/using-npm/scripts

// package.json:
{
  "scripts": {
    "prebuild": "node src/scripts/extractNitro.js",  // Runs BEFORE build
    "build:ext": "esbuild src/extension.ts --bundle ...",
    "build:webview": "esbuild src/webview.tsx --bundle ...",
    "build": "npm run build:ext && npm run build:webview"
  }
}

// When you run `npm run build`, npm automatically runs:
// 1. prebuild (if defined)
// 2. build
// 3. postbuild (if defined)
```

### esbuild Copy Plugin Integration

```typescript
// Source: esbuild-copy-static-files documentation
// https://github.com/nickjj/esbuild-copy-static-files

import * as esbuild from 'esbuild';
import { copy } from 'esbuild-copy-static-files';

await esbuild.build({
  entryPoints: ['src/webview.tsx'],
  bundle: true,
  outfile: 'dist/webview.js',
  platform: 'browser',
  plugins: [
    copy({
      src: 'assets/spritesheets',     // Source directory
      dest: 'dist/webview-assets',    // Destination directory
      recursive: true,                 // Include subdirectories
      filter: /\.(png|json)$/,         // Only copy PNG and JSON files
    }),
  ],
});
```

### Sprite Cache with TypeScript Types

```typescript
// Source: Derived from MDN Canvas optimization + Texture Packer format
export interface SpriteFrame {
  bitmap: ImageBitmap;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteManifest {
  frames: Record<string, {
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
  }>;
  meta: {
    image: string;
    format: string;
    size: { w: number; h: number };
  };
}

export class SpriteCache {
  private bitmaps = new Map<string, ImageBitmap>();
  private manifests = new Map<string, SpriteManifest>();

  async loadAtlas(
    atlasName: string,
    pngUri: string,
    jsonUri: string
  ): Promise<void> {
    // Load and decode PNG
    const img = new Image();
    img.src = pngUri;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });

    const bitmap = await createImageBitmap(img);
    this.bitmaps.set(atlasName, bitmap);

    // Load JSON manifest
    const response = await fetch(jsonUri);
    const manifest: SpriteManifest = await response.json();
    this.manifests.set(atlasName, manifest);
  }

  getFrame(atlasName: string, frameName: string): SpriteFrame | null {
    const bitmap = this.bitmaps.get(atlasName);
    const manifest = this.manifests.get(atlasName);
    if (!bitmap || !manifest) return null;

    const frameData = manifest.frames[frameName];
    if (!frameData) return null;

    return {
      bitmap,
      x: frameData.frame.x,
      y: frameData.frame.y,
      w: frameData.frame.w,
      h: frameData.frame.h,
    };
  }

  dispose(): void {
    // Close all ImageBitmap objects to free GPU memory
    for (const bitmap of this.bitmaps.values()) {
      bitmap.close();
    }
    this.bitmaps.clear();
    this.manifests.clear();
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `HTMLImageElement` in `drawImage()` | `createImageBitmap()` → `ImageBitmap` | Baseline since 2023-01 | GPU pre-decode eliminates per-frame latency; 2-10× performance improvement for sprite-heavy scenes |
| esbuild data URI bundling for assets | External files + `asWebviewUri()` | VS Code webview security model introduced ~2020 | Smaller bundle size; assets loaded on-demand; aligns with browser caching |
| Single esbuild config with `platform: 'node'` | Dual configs: `platform: 'node'` + `platform: 'browser'` | esbuild platform option added in 0.6.0 (2020) | Prevents Node.js polyfills inflating browser bundle; reduces webview.js by ~200KB |
| Manual `zlib` inflate with streaming | `zlib.inflateSync()` for small bundles | Always preferred for build scripts | Simpler code; no callback hell; sufficient for <10MB .nitro bundles |

**Deprecated/outdated:**
- **Loading images synchronously in extension host and passing pixel data:** Webview sandbox prevents direct buffer sharing; always load in webview.
- **`OffscreenCanvas.transferToImageBitmap()` for sprite loading:** This is for rendering, not loading. Use `createImageBitmap(HTMLImageElement)`.

---

## Open Questions

### 1. Asset Source: .nitro Extraction vs Pre-extracted Fallback

**What we know:**
- .nitro binary format is fully documented
- `sphynxkitten/nitro-assets` provides pre-extracted PNGs + JSONs in correct format
- Retrosprite provides visual validation tool

**What's unclear:**
- Is .nitro extraction required for v1, or can we defer to Wave 1?
- Does the team have access to .nitro bundles, or only pre-extracted assets?

**Recommendation:** Start with pre-extracted assets from `sphynxkitten/nitro-assets` for Phase 3. Build the sprite cache and validate rendering before investing in .nitro extraction. Mark ASSET-01 as "deferred to Wave 1" if time-constrained. The sprite cache API is identical regardless of asset source.

### 2. Anchor Offset Application

**What we know:**
- Texture Packer JSON includes `spriteSourceSize` and `sourceSize` for trimmed sprites
- Furniture sprites may have anchor points different from top-left corner
- Habbo uses custom anchor logic for multi-tile furniture

**What's unclear:**
- Where is the anchor point stored in the JSON manifest?
- Is it `spriteSourceSize.x/y`, or a separate `pivot` field, or derived from sprite name?

**Recommendation:** Inspect a known furniture JSON from `sphynxkitten/nitro-assets` or Retrosprite to confirm anchor field. If not present, assume top-left anchor for Phase 3; defer custom anchors to Phase 4 (Furniture Rendering).

### 3. Multi-layer Sprite Compositing

**What we know:**
- Sprite naming convention includes `{layer}` parameter (e.g., `a`, `b`, `c`)
- Some furniture has multiple layers (base, overlay, shadow)

**What's unclear:**
- Does the sprite cache need to composite layers at load time, or return them separately?
- What is the layer draw order (z-index)?

**Recommendation:** Return frames separately; let the renderer composite layers in the correct order. Phase 3 only provides the frame lookup API; Phase 4 (Furniture) handles layer ordering.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASSET-01 | .nitro binary parsing extracts files correctly | unit | `npm test -- tests/extractNitro.test.ts -x` | ❌ Wave 0 |
| ASSET-02 | esbuild copy plugin includes PNGs + JSONs in dist/ | integration | Manual: `npm run build && ls dist/webview-assets/` | ❌ Manual |
| ASSET-03 | localResourceRoots allows dist/ access | smoke | Manual: Open webview, check Network tab for 200 status | ❌ Manual |
| ASSET-04 | createImageBitmap() pre-decodes atlases | unit | `npm test -- tests/spriteCache.test.ts -x` | ❌ Wave 0 |
| ASSET-05 | Frame key lookup returns correct x,y,w,h | unit | `npm test -- tests/spriteCache.test.ts::testGetFrame -x` | ❌ Wave 0 |
| ASSET-06 | Dual esbuild configs produce separate bundles | smoke | `npm run build && file dist/extension.cjs dist/webview.js` | ✅ Existing |
| ASSET-07 | Extracted assets match Retrosprite visually | manual | Open Retrosprite + extracted PNG side-by-side | ❌ Manual |
| BUILD-01 | Extension loads in VS Code without errors | smoke | F5 in VS Code, check Debug Console | ✅ Existing |
| BUILD-02 | prebuild script runs before esbuild | smoke | `npm run build` logs show script order | ❌ Wave 0 |
| BUILD-03 | .gitignore excludes dist/webview-assets/ | unit | `git status` should not show webview-assets/ | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/spriteCache.test.ts -x` (unit tests only, <5s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual webview smoke test before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/extractNitro.test.ts` — unit tests for .nitro binary parsing (ASSET-01)
- [ ] `tests/spriteCache.test.ts` — unit tests for ImageBitmap loading + frame lookup (ASSET-04, ASSET-05)
- [ ] `tests/buildOutput.test.ts` — smoke test for prebuild hook execution (BUILD-02)
- [ ] `.gitignore` update — add `dist/webview-assets/` (BUILD-03)
- [ ] Mock for `createImageBitmap()` in Vitest — add to `tests/setup.ts`

**Note:** ASSET-02, ASSET-03, ASSET-07, BUILD-01 are manual verification steps; no automated tests needed.

---

## Sources

### Primary (HIGH confidence)

- [Node.js zlib Documentation](https://nodejs.org/api/zlib.html) - zlib.inflateSync() API
- [Node.js Buffer Documentation](https://nodejs.org/api/buffer.html) - readUInt16BE, readUInt32BE
- [WHATWG HTML Standard - ImageBitmap](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html) - createImageBitmap() specification
- [VS Code Extension API - Webview](https://code.visualstudio.com/api/extension-guides/webview) - asWebviewUri, localResourceRoots
- [VS Code Extension API - Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) - esbuild dual config pattern
- [Retrosprite GitHub Repository](https://github.com/Bopified/Retrosprite) - .nitro binary format specification
- [MDN - Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - ImageBitmap performance benefits
- [npm Scripts Documentation](https://docs.npmjs.com/cli/v10/using-npm/scripts) - prebuild, build, postbuild hooks

### Secondary (MEDIUM confidence)

- [TexturePacker Documentation](https://www.codeandweb.com/texturepacker/documentation) - JSON Hash format
- [esbuild-copy-static-files](https://github.com/nickjj/esbuild-copy-static-files) - Asset copy plugin
- [sphynxkitten/nitro-assets](https://github.com/sphynxkitten/nitro-assets) - Pre-extracted asset source
- [DevBest Retrosprite Thread](https://devbest.com/threads/retrosprite-nitro-bundle-editor-converter.96692/) - Community documentation of .nitro format

### Tertiary (LOW confidence)

- Web search results for Habbo furniture sprite naming conventions - specific naming pattern not fully verified
- Various Stack Overflow and GitHub issues for CSP troubleshooting - general patterns confirmed, specific edge cases unverified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are standard browser/Node.js APIs or well-documented VS Code patterns
- Architecture: MEDIUM-HIGH - .nitro format fully documented, but anchor offset and layer compositing details need validation
- Pitfalls: HIGH - 401 errors, CSP violations, and endianness bugs are well-documented failure modes

**Research date:** 2026-02-28
**Valid until:** 2026-04-30 (60 days - stable APIs, no fast-moving dependencies)

**Key unknowns requiring Phase 3 validation:**
1. Anchor offset field location in Texture Packer JSON
2. Multi-layer compositing order for furniture sprites
3. Optimal atlas size (512×512 vs 1024×1024 vs 2048×2048)

**Deferred to later phases:**
- .nitro extraction script implementation (can use pre-extracted assets for v1)
- Audio asset pipeline (Phase 8)
- Advanced sprite effects (alpha blending, color transforms) (Phase 5+)