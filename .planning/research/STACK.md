# Stack Research
## Isometric 2.5D Rendering Layer — VS Code Webview (Habbo v14 Reskin)
_Research date: 2026-02-28_

---

## Rendering: Canvas 2D vs WebGL vs PixiJS in VS Code Webview

### How VS Code Webviews Run

VS Code webviews are sandboxed HTML panels backed by Electron's Chromium renderer. They run in an isolated context equivalent to a cross-origin iframe. The key constraint is that the extension author controls the Content Security Policy (CSP) via a `<meta>` tag in the HTML shell — VS Code does not hard-block WebGL.

The recommended VS Code CSP baseline is:
```
default-src 'none';
img-src ${webview.cspSource} https: data:;
script-src ${webview.cspSource};
style-src ${webview.cspSource};
```

This policy does **not** block WebGL — WebGL is a capability of the underlying Chromium `<canvas>` element, not a separately gated CSP directive. WebGL calls go through the GPU process in Electron and are hardware-accelerated on macOS and Windows by default (Linux may require `--enable-gpu-rasterization` flags). No extra CSP token is needed to enable WebGL; only `script-src` must allow the PixiJS bundle source.

The one gotcha: `'unsafe-eval'` is required by some legacy bundlers and older PixiJS v6 builds. PixiJS v8 (2024+) ships as ESM and avoids `eval`, so it does not require `unsafe-eval`. WebAssembly execution requires `'wasm-unsafe-eval'` if any WASM is used, but pure PixiJS/Canvas 2D does not use WASM.

### Canvas 2D

- **What works:** Full support. `drawImage()`, `ctx.save()/restore()`, compositing, and `@font-face` all work inside a webview without any CSP relaxation beyond the default.
- **Performance:** CPU-bound. For a tile map of ~20×20 isometric tiles with per-frame redraws, Canvas 2D is sufficient for a VS Code tool (not a live game). Habbo Hotel v14 itself ran isometric rooms on Flash Player's software renderer at 15–30 fps on 2007 hardware; Canvas 2D on a modern Mac CPU is more than capable.
- **Depth sorting:** Must be implemented manually (painter's algorithm, sort-by-row).
- **Sprite atlas support:** Standard `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` clips sprite regions from a packed PNG atlas — no library needed.
- **Isometric math:** Standard 2:1 diamond tile projection. Screen coordinates: `screenX = (col - row) * (tileW / 2)`, `screenY = (col + row) * (tileH / 2)`. Well-documented; no library dependency required.

### PixiJS (v8, WebGL + WebGPU)

- **What works in Electron/webview:** PixiJS is confirmed to work inside Electron. VS Code's Electron shell uses Chromium with hardware GPU acceleration enabled on macOS and Windows. WebGL is available in webview panels. PixiJS v8 introduces a WebGPU renderer alongside WebGL, with automatic fallback to WebGL, then Canvas 2D.
- **PixiJS v8 CSP compatibility:** ESM build does not need `unsafe-eval`. The bundle must be served from a URI reachable by the webview's `script-src ${webview.cspSource}` (i.e., bundled into the extension's `dist/` folder and served via `vscode-resource:` URI).
- **Advantages for isometric rendering:** Batched sprite rendering, built-in `@pixi/spritesheet` loader that reads Texture Packer JSON atlas format, automatic depth sorting via container z-ordering, filter pipeline for future effects.
- **Disadvantages:** Adds ~1 MB minified to the webview bundle. Overkill if the room is static or updated infrequently. Requires managing PixiJS app lifecycle inside a React component (ref-based `useEffect` mount/unmount).
- **scuti-renderer** (GitHub: `mathishouis/scuti-renderer`) is a confirmed working open-source Habbo room renderer built on PixiJS + TypeScript that renders rooms, furniture, and avatars. This is strong evidence that PixiJS works for exactly this use case.

### WebGL (raw / Three.js)

- **What works:** Raw WebGL works in Electron webviews. Three.js also works. However, for a 2.5D isometric pixel-art renderer, using raw WebGL or Three.js is significantly more engineering effort than PixiJS or Canvas 2D with no meaningful benefit.
- **Not recommended** for this use case.

### What Is Actually Blocked by Default CSP

| Directive | Blocks |
|-----------|--------|
| No `unsafe-eval` | Older PixiJS v6/v7, some Webpack runtime chunks |
| No `unsafe-inline` | Inline `<script>` and `<style>` tags |
| No `connect-src` | `fetch()` / XHR to external URLs |
| No `wasm-unsafe-eval` | WASM execution |
| WebGL itself | **Not blocked** — it's a canvas API, not a CSP-gated resource |

### Recommendation

**Canvas 2D for initial implementation; migrate to PixiJS v8 if animation/performance demands arise.**

- Canvas 2D: zero extra bundle weight, no `unsafe-eval`, simpler React integration, sufficient for a static/low-fps office map tool.
- PixiJS v8: drop-in upgrade path if animated furniture, hover effects, or 60 fps scrolling are needed. The scuti-renderer provides a reference implementation.

**Confidence: High.** WebGL/PixiJS is not blocked by VS Code's webview sandbox on macOS/Windows. Canvas 2D works unconditionally.

---

## Nitro Asset Pipeline

### What Nitro Is

The Nitro project (primary repo: `billsonnn/nitro-react`, renderer: `billsonnn/nitro-renderer`) is an open-source TypeScript/React reimplementation of the Habbo Hotel HTML5 client. The renderer (`@nitrots/nitro-renderer`) is built on top of **PixiJS v6** (`@pixi/spritesheet`) and handles asset loading, room rendering, avatar rendering, and UI.

### How Asset Extraction Works

Habbo Hotel's original assets are distributed as Adobe SWF files (Flash). The Nitro pipeline converts these SWFs into a proprietary `.nitro` bundle format via `billsonnn/nitro-converter`.

**nitro-converter pipeline:**

1. **Input:** SWF files (downloaded from Habbo's CDN or a retro server's asset server, typically at `gordon/{version}/` paths).
2. **Conversion:** The converter extracts ActionScript-embedded graphics from each SWF (furniture, avatars, effects, tiles) and packs them.
3. **Output — `.nitro` bundle:** A binary container that holds:
   - One or more **PNG texture atlases** (sprite sheets)
   - A **JSON manifest** describing sprite regions (frame name → x, y, w, h coordinates within the atlas), animation sequences, asset metadata, and furniture visualization data.
4. The `.nitro` format is read by `nitro-renderer`'s `NitroBundle` loader at runtime and parsed into PixiJS `Spritesheet` objects using `@pixi/spritesheet`'s standard JSON atlas format (compatible with Texture Packer "hash" format).

### Can Assets Be Extracted Standalone (Without Running Full Nitro)?

**Yes.** The `.nitro` bundle is a ZIP-like container. The community has confirmed that `.nitro` files can be unzipped to extract the raw PNG atlas and JSON manifest files directly. These can then be loaded into any Canvas 2D or PixiJS renderer without the full Nitro stack.

**Workflow for standalone use:**
1. Run `nitro-converter` against SWF files to produce `.nitro` bundles.
2. Unzip the `.nitro` bundles to get `spritesheet.png` + `spritesheet.json`.
3. Consume the JSON atlas in Canvas 2D (`drawImage` with region lookup) or PixiJS (`Spritesheet` loader).

**nitro-imager** (`billsonnn/nitro-imager`) is a separate server-side avatar renderer that downloads and caches `.nitro` assets and produces rendered PNG images — useful as a reference for headless asset consumption.

### Retrosprite

`Bopified/Retrosprite` is a newer (late 2025/early 2026) GUI tool specifically for viewing, editing, and converting SWF assets into Nitro-compatible JSON formats. It provides a visual interface for the conversion pipeline and targets the Nitro ecosystem. Useful for validating extracted sprite data.

### Key Limitation

The SWF source assets themselves are proprietary Sulake property. For a personal tool targeting Habbo v14, you must supply your own SWFs from a v14 retro server (e.g., Kepler, Odin, or a personal archive). The converter and the `.nitro` format are open-source; the SWFs are not.

---

## Alternative Asset Sources

### Pre-Extracted Habbo Nitro Asset Repositories

| Repository | Description | Status |
|------------|-------------|--------|
| `sphynxkitten/nitro-assets` | Community-maintained collection of pre-converted `.nitro` bundles including furniture, clothes, effects, and pets. Completely reconverted with updated `HabboAvatarActions.json`. | Active (2024–2025) |
| `TamedWolfy/Nitro` | Additional Nitro assets collection. | Active |
| `Holo5/nitro-docker` | Docker stack that self-hosts a full nitro-assets server; pulls from `nitro-swf` and pre-extracts all assets to `nitro-assets`. | Active |

**Note:** These repositories contain assets converted from Habbo's proprietary SWFs. They are usable for personal tools but are not licensed for redistribution or commercial use. Sulake's ToS applies.

**Sprite Database** (spritedatabase.net/game/2735) hosts catalogued Habbo sprites including v14-era furniture, but as individual PNG exports rather than production-ready atlases.

### Extraction Tools

| Tool | Language | Output | Notes |
|------|----------|--------|-------|
| `billsonnn/nitro-converter` | TypeScript/Node | `.nitro` bundles (PNG atlas + JSON) | Primary tool for modern Nitro pipeline |
| `scottstamp/FurniExtractor` | C# | PNG + JSON per furniture item | Simpler, outputs individual PNGs and Habbo-format JSON; good for selective extraction |
| `dank074/habbo-asset-extractor` | PHP | PNG images from SWF | Older, extracts raw images without atlas packing |
| `Quackster/Chroma` | .NET/C# | PNG renders per furniture | Server-side renderer; SWFs in `/swfs/hof_furni/`; outputs isometric renders via HTTP API |
| `Quackster/Elias` | Java/C# | CCT format (v14-era binary) | Converts modern SWF furniture back to v14 `.cct` format — useful for v14 server compatibility |
| `Bopified/Retrosprite` | Electron/TypeScript | JSON + PNG (Nitro-compatible) | GUI editor/converter; released early 2026 |
| `duckietm/All-in-1-converter` | Multi | Various | Community fork combining multiple converter tools |
| `higoka/habbo-downloader` | TypeScript/Node | Raw SWF download | Downloads SWFs from Habbo CDN before conversion |

### Habbo v14-Specific Resources

- **Quackster/Kepler** — Most complete open-source Habbo v14 (2007-era) server emulator in Java. The release packages include asset sets appropriate for v14, which can be fed into extraction tools.
- **Webbanditten/Odin** — Alternative Habbo Hotel v14 server in Java.
- The v14 client used `.dcr` (Shockwave) and `.swf` files. The SWF furniture assets from later Habbo versions are largely backward-compatible in visual style (isometric, 2:1 diamond tiles, same color palettes). True v14 originals exist in community archives but are not on public GitHub.

### CycloneIO

`itsezc/CycloneIO` is a full-stack open-source Habbo package (CMS + server + client + assets). Its assets sub-package may contain pre-bundled resources.

---

## Font Options

### Volter (Goldfish) — The Authentic Habbo Font

Volter (also called "Volter Goldfish") is the original Habbo Hotel interface font — a bitmap pixel font designed by Sulake (credited to "cocoFabien" on DaFont). Sulake released it under a permissive free license allowing personal and commercial use, modification, and redistribution, with one restriction: it may not be sold as a standalone font product.

- **License:** Free for personal and commercial use; not for resale as a font. Sulake explicitly released this for community use.
- **GitHub mirror:** `eonu/goldfish` — hosts Volter and Volter-Bold as web-ready TTF/WOFF files.
- **Canvas `@font-face` usage:** Fully supported. Load the TTF as a data URI or local resource in the webview, declare `@font-face`, and use `ctx.font = '8px Volter'` on the canvas.
- **Recommendation:** Use Volter for maximum visual authenticity. It is the safest choice for a personal non-commercial tool.

### Open-Source Alternatives (If Volter Is Avoided)

| Font | Size/Style | License | Notes |
|------|------------|---------|-------|
| **Press Start 2P** | 8px bitmap | OFL 1.1 (SIL Open Font License) | Based on 1980s Namco arcade fonts; designed by Codeman38; available on Google Fonts; works at 8px, 16px and multiples of 8 |
| **Dogica / Dogica Pixel** | 8x8 monospace | OFL | GB Studio-designed; 200+ characters; both monospace and kerned variants |
| **m5x7** by Daniel Linssen | 5×7px | CC0 / Free | Available on itch.io; very legible at small sizes; commonly used in indie pixel art games |
| **Pixeldroid fonts** (`pixeldroid/fonts` on GitHub) | Various | OFL | Collection of open-source pixel fonts for game development |
| **Minimalist Pixel Fonts** (OpenGameArt) | Various | CC0/OFL | Community-contributed, suitable for canvas use |

### Canvas `@font-face` Integration Pattern

```html
<style>
  @font-face {
    font-family: 'Volter';
    src: url('${webview.assetUri('fonts/volter.ttf')}') format('truetype');
  }
</style>
```

```typescript
// After font load, use in canvas context:
ctx.font = '8px Volter';
ctx.fillStyle = '#ffffff';
ctx.fillText('Room 1', x, y);
```

Fonts must be served from the extension's static assets (via `vscode.Uri.joinPath` + `webview.assetUri`). External Google Fonts CDN URLs require relaxing `style-src` and `font-src` to include `https://fonts.googleapis.com` and `https://fonts.gstatic.com`, which is possible but adds attack surface. Bundling the TTF file locally is recommended for a personal tool.

---

## Recommendations

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Rendering engine | Canvas 2D | Browser native | Zero bundle overhead; sufficient for a VS Code tool panel; not blocked by webview CSP; upgrade path to PixiJS v8 is straightforward |
| Rendering fallback/upgrade | PixiJS | v8.x (2024+) | If animation, scrolling, or per-frame performance becomes a bottleneck; confirmed working in Electron; no `unsafe-eval` required; `scuti-renderer` provides Habbo-specific reference implementation |
| Asset extraction | nitro-converter | Latest (Node 18+) | Primary tool; outputs `.nitro` bundles (PNG atlas + JSON manifest) that unzip to standalone web-compatible assets |
| Asset source (pre-extracted) | sphynxkitten/nitro-assets | Latest | Community-maintained pre-extracted Nitro bundles; fastest path to getting furniture/avatar assets without running the full pipeline |
| Quick SWF-to-PNG (furniture only) | scottstamp/FurniExtractor | Latest | Simpler C# tool for selective furniture extraction when full nitro-converter pipeline is excessive |
| Habbo v14 server reference | Quackster/Kepler | Latest release | Most complete v14 emulator; provides compatible asset set |
| Pixel font (authentic) | Volter (Goldfish) | v1.0 | Sulake-released; free for personal use; visually identical to original Habbo UI |
| Pixel font (pure OFL fallback) | Press Start 2P | Latest | OFL 1.1; on Google Fonts; bundle locally as TTF for webview use |
| Reference isometric renderer | mathishouis/scuti-renderer | Latest | Open-source Habbo room engine in TypeScript + PixiJS; study its tile math, sprite loading, and depth sorting |

### Additional Implementation Notes

1. **Isometric tile math:** Standard 2:1 diamond projection. Habbo tiles are 64px wide × 32px tall (screen space). Tile origin at top diamond vertex. Furniture sprites have additional y-offset encoded in the JSON manifest.

2. **Depth sorting:** Paint order is row-major (back-to-front), then within a row, objects closer to the viewer (lower row index + higher column index) paint last. Habbo encodes this in the `z` value in its furniture visualization XML.

3. **`.nitro` bundle access:** The bundle is a standard ZIP file. Use Node's built-in `zlib` or the `jszip` library to unpack PNG and JSON at build time (pre-process assets before bundling into the extension) rather than at runtime in the webview.

4. **CSP for bundled assets:** All fonts, images, and scripts should be served from the extension's own `dist/` folder. Use `webview.assetUri()` to generate safe `vscode-resource:` URIs. No external CDN dependencies.

5. **React 19 + Canvas integration:** Mount the canvas via a `ref` in a `useEffect`. Use `useRef<HTMLCanvasElement>` to get the 2D context. Avoid React re-renders driving canvas redraws — use a separate render loop (or single paint call) that reads from a separate state model.

---

_Sources consulted: GitHub repositories (billsonnn/nitro-converter, billsonnn/nitro-renderer, mathishouis/scuti-renderer, scottstamp/FurniExtractor, sphynxkitten/nitro-assets, eonu/goldfish, Quackster/Kepler, Bopified/Retrosprite, dank074/habbo-asset-extractor, pixijs/pixijs); VS Code extension API documentation; Google Fonts (Press Start 2P); FontLibrary (Dogica); meshcloud GPU acceleration blog; Trail of Bits VSCode security blog._
