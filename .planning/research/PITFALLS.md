# Pitfalls Research
## Habbo Pixel Agents — Isometric Rendering Layer
_Research date: 2026-02-28_

---

## VS Code Webview CSP Restrictions

### What the Default Policy Looks Like

VS Code recommends this baseline CSP (set via `<meta>` tag in the webview HTML, not via HTTP headers):

```
default-src 'none';
img-src ${webview.cspSource} https: data:;
script-src ${webview.cspSource};
style-src ${webview.cspSource};
```

`${webview.cspSource}` expands to the `vscode-resource:` scheme, which only covers files served from the extension's own directories (via `webview.asWebviewUri()`). All external origins are blocked.

### What Is Blocked by Default

| Feature | Status | Notes |
|---------|--------|-------|
| `eval()` / `new Function()` / `setTimeout(string)` | BLOCKED | No `unsafe-eval` in default policy; PixiJS v6/v7 needed this, v8 does not |
| Inline `<script>` tags | BLOCKED | No `unsafe-inline`; all scripts must be external files |
| Inline `<style>` tags | BLOCKED | No `unsafe-inline`; styles must be external files |
| External CDN scripts | BLOCKED | `script-src` only allows `${webview.cspSource}` |
| External CDN fonts (Google Fonts) | BLOCKED | `font-src` not in default policy; needs explicit addition |
| `fetch()` / XHR to external URLs | BLOCKED | No `connect-src` for external origins |
| WASM execution | BLOCKED | Requires explicit `wasm-unsafe-eval` token |
| Data URIs for images | **ALLOWED** | `img-src ... data:` is in the recommended policy |
| WebGL | **ALLOWED** | WebGL is a Canvas API capability, not a CSP-gated resource |
| Web Audio API (`AudioContext`) | **PARTIALLY ALLOWED** | See audio section below |

### Web Workers — Confirmed Broken Pattern

Web Workers cannot load scripts from `vscode-resource://` URIs. Chrome enforces cross-origin restrictions: a worker script at `vscode-resource://...` cannot be loaded from the webview's `null` origin context (GitHub issue [#87282](https://github.com/microsoft/vscode/issues/87282), closed 2021, limitation persists).

The blob URL workaround (`URL.createObjectURL(new Blob([workerCode]))`) is the only documented path, but it has downstream problems: the worker cannot use `importScripts()` for additional modules, and any chunk-splitting by the bundler breaks because the worker requests blob-prefixed URLs instead of proper origins.

**Mitigation for this project:** The isometric renderer does not require Web Workers. All rendering is synchronous Canvas 2D in the main thread. Do not design any feature that requires off-thread computation via Workers (e.g., A* pathfinding in a Worker, image decode in a Worker) unless you are prepared to use the blob URL workaround with inline bundled code.

### Audio — The Biggest Surprise

VS Code does **not** ship ffmpeg in its Electron build. This blocks most audio codec decoding in webviews (GitHub issues [#66050](https://github.com/microsoft/vscode/issues/66050), [#54097](https://github.com/microsoft/vscode/issues/54097)).

Confirmed behaviour:
- **MP3 via `<audio>` element:** Often fails — no AAC/MP3 decoder shipped.
- **`AudioContext.decodeAudioData()` on MP3:** Throws `DOMException: Unable to decode audio data` (GitHub issue [#148494](https://github.com/microsoft/vscode/issues/148494)).
- **WAV and OGG:** More likely to work because these formats use uncompressed or open codecs supported by Chromium's built-in decoders without ffmpeg. The `vscode-audio-preview` extension (confirmed working, updated June 2024) supports WAV and OGG and uses a WASM-compiled C++ decoder for formats that need it.

**Confirmed safe approach for Habbo sounds:**
1. Convert all Habbo sound effects to **OGG Vorbis** or **uncompressed WAV** at build time.
2. Serve them via `webview.asWebviewUri()` (local file, no external fetch).
3. Load with `AudioContext.decodeAudioData()` from a fetched `ArrayBuffer`.
4. Add `media-src ${webview.cspSource};` to the CSP meta tag.
5. Gate AudioContext creation behind a user gesture to avoid the autoplay policy block.

**Risk:** Even with OGG, codec availability in Electron varies across VS Code versions. Test audio playback on the actual target VS Code version. If it fails, the fallback is silence (non-critical for a personal tool).

### Asset URIs — Critical Pattern

All static assets (PNG atlases, fonts, audio, JSON manifests) must be served through the `vscode-resource:` scheme. The pattern:

```typescript
// Extension side (TypeScript):
const assetUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview-assets', 'chair.png')
);
// Pass the URI string into the webview HTML or via postMessage
```

Do not use `file://` URIs — they are rejected. Do not use `data:` URIs for large assets (bloats the HTML). Do not `fetch()` from external URLs without adding `connect-src` to the CSP.

### localResourceRoots Gotcha

If `localResourceRoots` is set to `[]` (empty array), all local file access is blocked — including assets in your own extension's `dist/` directory. Always include the extension's output folder:

```typescript
localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
```

Omitting this causes assets to silently return 401/Access Denied with no useful error in the webview console (GitHub Discussion [#2707](https://github.com/microsoft/vscode-discussions/discussions/2707)).

---

## Canvas 2D Performance Pitfalls

### Pitfall 1: Full-Canvas Redraw Every Frame (Overdraw)

**What goes wrong:** Calling `ctx.clearRect(0, 0, canvas.width, canvas.height)` every `requestAnimationFrame` then redrawing all tiles, furniture, and avatars clears and repaints every pixel even when nothing moved.

**Why it matters for isometric tile maps:** A 20×20 Habbo room has 400 floor tiles. Each tile is a filled rhombus path (`beginPath` + 4 `lineTo` + `fill`). At 30 fps, that is 12,000 path draw calls per second for the floor alone, before furniture or avatar sprites.

**Mitigation strategies (in order of implementation cost):**

1. **Layer separation with multiple canvases (LOW cost, HIGH impact):** Render static elements (floor tiles, walls, furniture) to an offscreen canvas once; composite to the main canvas on each frame with a single `drawImage`. Only redraw the offscreen canvas when the layout changes. Avatar and bubble layers redraw every frame on the main canvas only.

2. **Dirty rect tracking (MEDIUM cost):** Track which tiles changed (agent moved, tile colour changed) and call `ctx.clearRect` + redraw only the bounding box of changed elements. Requires maintaining a dirty-flag per renderable.

3. **Skip frames when idle (LOW cost):** If no agent state changed since the last frame, skip the `clearRect` + redraw entirely. Add a boolean `isDirty` flag to the render loop.

**Habbo-specific note:** The room background (floor + walls) is fully static between agent actions. Pre-render it once to `OffscreenCanvas` at startup and blit it every frame with one `drawImage` call.

### Pitfall 2: `ctx.save()` / `ctx.restore()` in Tight Sprite Loops

**What goes wrong:** Calling `ctx.save()` and `ctx.restore()` for every sprite draw (e.g., once per avatar body part, once per furniture layer) causes excessive state stack allocations. For a room with 10 agents × 8 body-part layers = 80 save/restore pairs per frame.

**Mitigation:** Set `ctx.globalAlpha`, `ctx.globalCompositeOperation` once before the sorted draw list loop. Restore manually by re-setting the values rather than using save/restore. Only use save/restore when the state change is truly complex (e.g., clipping paths for speech bubble tails).

### Pitfall 3: Depth Sorting Failure for Multi-Tile Furniture

**What goes wrong:** The simple sort key `tileX + tileY + tileZ * epsilon` breaks for furniture larger than 1×1 tiles. A 2×2 table has four tile positions; if the sort key is computed from its origin tile only, it can paint over avatars standing on adjacent tiles that should appear "in front of" the table.

**Why it happens:** The painter's algorithm requires a total ordering of all drawables. Multi-tile objects violate this ordering when their bounding box overlaps other objects along the sort axis.

**Mitigation:** For each multi-tile furniture item, compute the sort key from its **farthest tile from the camera** (max `tileX + tileY` in the footprint), not its origin tile. For the pixel-agents scope (desk + chair minimum), this is a one-time fix at the furniture placement code level.

**The deeper problem:** Topological cycles in the depth order (sprite A is "in front of" sprite B which is "in front of" sprite A due to overlap) are unresolvable with the painter's algorithm. Habbo's original renderer avoided this through room design conventions (furniture does not overlap avatars in ways that create cycles). Follow the same convention: do not place furniture that creates visual cycles with agent walking paths.

### Pitfall 4: Sprite Atlas Decode Cost on First `drawImage`

**What goes wrong:** When an `HTMLImageElement` is passed to `drawImage` for the first time, the browser decodes the compressed PNG and uploads it to the GPU texture cache. This causes a single-frame hitch (often 20-50 ms for a 1024×1024 atlas).

**Mitigation:** After loading the PNG image element, call `createImageBitmap(img)` immediately to force decode and create a GPU-resident `ImageBitmap`. Store the `ImageBitmap` instead of the raw `HTMLImageElement` in the sprite cache, and use it in all subsequent `drawImage` calls. `ImageBitmap` draws are significantly cheaper because no decode happens at draw time.

**Warning:** `createImageBitmap` is asynchronous. Ensure the load sequence is: `Image.onload` → `createImageBitmap(img)` → store result → mark sprite as ready. Do not draw from the sprite cache until the `ImageBitmap` is available.

### Pitfall 5: `ctx.beginPath()` Without `ctx.closePath()` in Rhombus Drawing

**What goes wrong:** If `ctx.beginPath()` is called before each tile but `ctx.closePath()` is omitted, the path accumulates across calls in some browser/Electron versions, growing unboundedly. The cost of `ctx.fill()` grows linearly with path length.

**Mitigation:** Always call `ctx.closePath()` after the last `lineTo` of each rhombus, before `ctx.fill()`. Alternatively, call `ctx.beginPath()` before every tile (this implicitly discards the previous path, but is explicit).

### Pitfall 6: `requestAnimationFrame` Scheduling in an Inactive Webview Panel

**What goes wrong:** VS Code webview panels can be hidden (the user switches to another editor tab). When hidden, the webview iframe is not destroyed — it keeps running. The `requestAnimationFrame` loop continues firing but at a throttled rate (typically 1 fps or paused entirely). When the panel becomes visible again, the loop may fire multiple times in rapid succession to "catch up", causing frame bursts.

**Mitigation:** Use the `document.visibilitychange` event to pause the rAF loop when the panel is hidden:

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
  } else {
    rafId = requestAnimationFrame(renderLoop);
  }
});
```

---

## Asset Licensing Risk

### Sulake DMCA History

Sulake Corporation Oy holds copyright over all Habbo Hotel assets: sprites, sounds, fonts (Volter), and the game client SWF files. Their enforcement history on GitHub (documented in the public DMCA repo at `github/dmca`):

- **March 2015:** Two separate DMCA notices targeting five repositories (HabboPHP, Snowlight, BloonPHP, Habbo-Server, and others). The legal theory was Section 1201 of the DMCA — "bypass of technological protection measures" — not simple copyright infringement. One counter-notice was filed and the complaint was disputed.
- **No documented GitHub DMCA takedowns from Sulake between 2016-2025** appear in the public `github/dmca` repository.

### Community Consensus on Risk Profile

Based on community sources (DevBest forums, Habbo Wiki):

1. **Sulake's primary enforcement focus is monetisation.** Projects operating paid retro hotels (charging credits or selling virtual goods) are the primary targets. Open-source tools that do not compete commercially with Habbo have historically been left alone.
2. **There are too many retro projects for comprehensive enforcement.** Sulake has acknowledged this implicitly by reducing enforcement frequency.
3. **GitHub projects with "Habbo" in the name or README were targeted in 2015.** The DMCA complaint admitted this was partly triggered by the word "Habbo" in repository names, not just the code content.
4. **Asset redistribution is the highest-risk act.** Distributing extracted SWF files or packaged Nitro bundles is riskier than distributing a renderer that expects the user to supply their own assets.

### Risk Classification for This Project

| Action | Risk Level | Reasoning |
|--------|------------|-----------|
| Using pre-extracted assets from `sphynxkitten/nitro-assets` locally | LOW | Personal use only; no redistribution; no monetisation |
| Committing extracted PNG/JSON assets to a **private** git repo | LOW | No public distribution |
| Committing extracted PNG/JSON assets to a **public** git repo | MEDIUM | Public distribution of Sulake IP; remains in community-tolerated zone but is higher exposure |
| Distributing the VS Code extension (marketplace or direct) with bundled Sulake assets | HIGH | Distribution of copyrighted content; much higher exposure than personal-only use |
| Using Volter font (Goldfish) | LOW | Sulake explicitly released Volter for free personal and commercial use; not for resale as a standalone font product. See STACK.md. |
| Using Habbo sound effects | LOW-MEDIUM | No explicit license grant from Sulake for sounds; personal use only; not distributing publicly |

**Recommended stance:** Keep extracted assets out of any public repository. Reference `sphynxkitten/nitro-assets` as the source in documentation, do not commit the binary files to this repo. Document clearly that the tool is personal-only and requires the user to supply their own assets (or fetch from `nitro-assets`) to run.

### Sounds Specifically

No explicit license grant exists for Habbo sound effects. The community norm is to use them in personal retro projects without issue. For this tool (personal, non-distributed), the risk is negligible. If the project ever goes public or distributed, sounds should be replaced with royalty-free alternatives.

---

## Nitro Asset Completeness

### What `sphynxkitten/nitro-assets` Contains

Categories confirmed present in the repository:
- Furniture (floor furni, wall furni)
- Clothing / figure parts
- Effects
- Pets
- Game data JSON (furnidata, figuredata, figuremap, HabboAvatarActions.json)

### Known Completeness Gaps

The maintainer's own README states: *"Completely reconverted as I lost track of additions and converter updates."* This means the repository is periodically bulk-reconverted rather than incrementally maintained. Specific gaps:

1. **v14-era classic furniture is not guaranteed to be present.** The repository tracks Habbo's live CDN assets, which are modern Habbo Hotel (current era). Classic v14 (2007-era) furniture that no longer exists in the live game may be missing or visually restyled. Example: original wooden stools, classic desks, and early Habbo chairs that were redesigned post-2010.

2. **Custom furniture is not covered.** The README explicitly notes: *"conversion is for default furniture only, with custom furniture requiring separate handling."*

3. **HabboAvatarActions.json was broken until February 2024.** The most recent documented update (05/02/24) was specifically to fix this file. Any project set up before that date and using a stale copy may have broken avatar animations.

4. **The avatar figure composer is incomplete for v14 looks.** The avatar sprite system in Nitro is designed for the modern Habbo figure format. Classic v14 avatar clothing and body parts may not have direct equivalents. For this project, this is partly mitigated by using the 6-variant palette system (fixed character sprites) rather than a full avatar composer.

5. **No room background / wallpaper assets.** Background textures and wallpapers exist as separate SWF assets not included in the furniture extraction. Programmatically drawn walls (Canvas 2D path fills) avoid this gap entirely.

### Furniture Specifically Needed for pixel-agents V1

The project requires these 8 furniture types (from PROJECT.md):
- Desk (or table)
- Chair
- Computer / monitor
- Lamp or light
- Plant or decoration
- Bookshelf or cabinet
- Rug or floor mat
- Whiteboard or notice board

All 8 are standard Habbo furniture types that exist in modern furnidata. They should be present in `sphynxkitten/nitro-assets`. However, the **v14-era visual style** of these items (lower polygon, slightly different color palette) may differ from what is in the repository. Verify each item visually before committing to it.

### Mitigation Plan for Gaps

1. **Validate each required furniture item exists** in the pre-extracted assets before writing the furniture renderer.
2. **For missing classic v14 items**, use the closest modern equivalent (isometric projection and 64px tile size are unchanged; only the texture/colour differs).
3. **If the avatar figure system is too complex**, continue with the palette-variant approach (fixed sprites per character variant) which does not require the full Nitro avatar composer.
4. **Fallback extraction path:** Run `billsonnn/nitro-converter` against SWFs from a Kepler v14 server asset set if v14-specific items are required that are missing from `sphynxkitten/nitro-assets`.

---

## React + Canvas Game Loop Pitfalls

### Pitfall 1: React StrictMode Double-Mount Breaks the Render Loop

**What goes wrong:** React 19 in development mode (StrictMode) mounts, unmounts, and remounts every component once immediately after the initial mount. This means `useEffect` runs twice. For a canvas game loop, this results in:
- Two `requestAnimationFrame` loops running simultaneously
- Double the draw calls per frame
- The cleanup function from the first mount is called on the *second* mount's cleanup function (a React bug, GitHub issues [#25614](https://github.com/facebook/react/issues/25614), [#30835](https://github.com/facebook/react/issues/30835))

**Why it's dangerous specifically for canvas:** If the rAF loop ID is stored in a module-level variable (or not stored at all), the cleanup function may cancel the wrong loop or no loop, leaving a ghost loop running after unmount.

**The correct pattern:**
```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let animId: number;
  let running = true;

  function loop() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ... draw ...
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  return () => {
    running = false;          // stop the loop from scheduling new frames
    cancelAnimationFrame(animId); // cancel the pending frame
  };
}, []); // empty deps — mount/unmount only
```

The `running` boolean is critical. It ensures that even if the cleanup is called with a stale `animId` (the StrictMode double-mount bug), the loop function itself will self-terminate on the next tick.

### Pitfall 2: Stale Closures Capturing Outdated Agent State

**What goes wrong:** The rAF loop callback closes over React state at the time of `useEffect` execution. If agent state (positions, animation frames, speech bubbles) is held in React `useState`, the loop captures the initial empty state and never sees updates.

**Why it happens:** `useEffect` with `[]` dependencies runs once at mount. The loop closure captures the state value from that moment. Subsequent `setState` calls do not update the closure's captured reference.

**The correct pattern:** Store mutable render state in a `useRef`, not `useState`. The ref's `.current` is always the latest value:
```typescript
const agentStateRef = useRef<AgentMap>({});

// Update from message handler (no re-render triggered):
agentStateRef.current[id] = { ...newState };

// Read in rAF loop (always current):
const agents = agentStateRef.current;
```

React `useState` is appropriate for triggering UI re-renders (e.g., toggling a settings panel). It is inappropriate as the primary store for game state consumed by a rAF loop.

### Pitfall 3: Canvas Size Mismatch (CSS Pixels vs Device Pixels)

**What goes wrong:** Setting `canvas.width` and `canvas.height` equal to the CSS layout size (e.g., `800 × 600`) on a HiDPI display (devicePixelRatio = 2) results in blurry rendering because the canvas rasterizes at 800×600 but is displayed at 1600×1200 CSS pixels scaled down by the browser.

**Mitigation:**
```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = canvas.offsetWidth * dpr;
canvas.height = canvas.offsetHeight * dpr;
ctx.scale(dpr, dpr); // scale all draw calls to compensate
```

This is particularly visible with pixel art sprites — blurring a 64×32 isometric tile at 2× DPR destroys the crisp pixel-art aesthetic.

Also set `ctx.imageSmoothingEnabled = false` when drawing pixel sprites to prevent bilinear interpolation.

### Pitfall 4: React Re-renders Triggering Canvas Redraws

**What goes wrong:** If the parent component re-renders (e.g., VS Code theme changes, a sidebar state update), and the canvas is inside the re-rendering component tree without memoisation, the entire canvas element may be recreated. This:
- Destroys the existing 2D context
- Clears the canvas content
- Causes the `useEffect` cleanup to run and then re-run, restarting the loop

**Mitigation:** Wrap the canvas component in `React.memo` and pass only stable props. Extract agent state updates from React's render path into `useRef` (see Pitfall 2). The canvas component should ideally have zero re-renders after initial mount.

### Pitfall 5: Message Handler and rAF Loop Race Condition

**What goes wrong:** The VS Code extension sends agent updates via `window.addEventListener('message', handler)`. The handler updates render state. The rAF loop reads render state. If the handler runs during a partially-complete draw pass, you can get torn frames (avatar at position A, furniture drawn for position B).

**Mitigation:** The handler should write to a double-buffered state ref or a queue. The rAF loop reads from the current buffer at the start of each frame:
```typescript
// Pending updates queue (written by message handler):
const pendingUpdates = useRef<AgentUpdate[]>([]);

// In rAF loop (first thing each frame):
const updates = pendingUpdates.current.splice(0);
updates.forEach(applyUpdate); // mutates agentStateRef.current
```

This is effectively a producer-consumer pattern over a shared array. Since JavaScript is single-threaded, no mutex is needed — the splice is atomic within a single event loop turn.

---

## Build/Bundle Pitfalls

### Pitfall 1: esbuild `file` Loader + VS Code Asset URIs Don't Mix

**What goes wrong:** esbuild's `file` loader copies assets to `outDir` and embeds the **relative file path string** in the bundle (e.g., `"./assets/chair.png"`). In a VS Code webview, this path is meaningless — assets cannot be loaded from relative paths because the webview runs from a `null` origin. The URL must be a `vscode-resource://` URI generated via `webview.asWebviewUri()`.

**Root cause:** esbuild's `publicPath` option prefixes the stored path string with a static base URL. VS Code asset URIs are dynamic (they include a nonce that changes per session), so they cannot be set at build time.

**The correct approach — do not import PNGs or audio files in JS bundles for webview assets.** Instead:
1. Copy assets to `dist/webview-assets/` using a separate build step (Node `fs.cpSync`, or `cp -r` in the build script).
2. In the extension TypeScript code, construct the `vscode-resource://` URI using `webview.asWebviewUri()` and pass the URI string into the webview via the initial HTML template or via a `postMessage`.
3. In the webview code, receive the asset URI map and load images/audio using standard `new Image()` + `src = uri` or `fetch(uri)`.

This avoids the esbuild asset path problem entirely because assets are never imported as ES modules.

### Pitfall 2: `.nitro` Binary Files Are Not a Recognized esbuild Format

**What goes wrong:** If `.nitro` files are placed in a directory that esbuild processes, it will fail with "No loader is configured for '.nitro' files" or silently skip them.

**Mitigation:**
- Do not pass `.nitro` files through esbuild at all.
- The recommended pipeline is: run a Node.js pre-build script (`extractNitro.ts`) that reads the binary `.nitro` files and outputs PNG + JSON pairs into `dist/webview-assets/`. These outputs are then served as static files, not bundled.
- If `.nitro` files are large (some furniture bundles are 500 KB+), do not embed them in the JS bundle even with the `binary` loader. Embedding them bloats the bundle and re-encodes them as base64, tripling the in-memory size at load time.

### Pitfall 3: PNG Atlas Size and Data URI Bloat

**What goes wrong:** Using esbuild's `dataurl` loader for PNG atlases embeds the PNG as a base64 data URI inside the JS bundle. A 512×512 PNG atlas (~100 KB compressed) becomes ~133 KB of base64 text inside the JS. A 1024×1024 atlas becomes ~500 KB of text. At 5-10 atlases for a full furniture set, this can add 2-5 MB to the webview bundle.

**Impact:** Webview first-load time increases significantly. VS Code does not cache webview bundles across sessions in the same way a browser caches page assets.

**Mitigation:** Use the `copy` loader or a post-build file copy step to keep PNG atlases as separate files served via `vscode-resource://` URIs. The webview loads them on demand using `new Image()`.

### Pitfall 4: TypeScript Path Aliases Break in Webview Bundles

**What goes wrong:** If `tsconfig.json` defines path aliases (e.g., `"@shared/*": ["src/shared/*"]`), esbuild resolves them only if explicitly configured via `alias` in the esbuild config. Forgetting to configure aliases results in runtime "Cannot find module '@shared/...'" errors that only appear in the bundled webview, not during `tsc` typecheck.

**Mitigation:** Mirror all `tsconfig` `paths` entries in the esbuild `alias` config. Validate by checking the bundled output includes the actual shared code, not a failed `require('@shared/...')` call.

### Pitfall 5: Separate Extension and Webview Build Configs Required

The VS Code extension has two separate entry points with different targets:
- **Extension host** (`src/extension.ts`): targets Node.js (`platform: 'node'`), can use `require('vscode')`, `require('fs')`, etc.
- **Webview UI** (`src/webview/index.tsx`): targets browser (`platform: 'browser'`), cannot use Node.js built-ins.

**What goes wrong:** Using a single esbuild config for both or accidentally importing Node.js modules from the webview bundle results in runtime errors like "Buffer is not defined" or "process is not defined" inside the webview.

**Mitigation:** Two separate esbuild configurations, two separate output files. The extension host external-izes `vscode`. The webview bundle marks `vscode` as an empty module (it's not available in the browser context).

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Audio playback fails in webview (no MP3 codec) | HIGH | MEDIUM | Convert all sounds to OGG Vorbis; test on target VS Code version; accept silence as fallback |
| Web Worker pattern attempted, breaks on blob URL | MEDIUM | LOW | Avoid Workers entirely; all rendering is single-threaded Canvas 2D |
| React StrictMode double-mount breaks rAF loop | HIGH (dev only) | MEDIUM | Use `running` boolean guard in loop; test both dev and production builds |
| Stale closure in rAF captures empty agent state | HIGH | HIGH | Store all game state in `useRef`, not `useState` |
| esbuild `file` loader breaks webview asset paths | HIGH | HIGH | Never import PNGs/audio in JS; use separate copy step + asWebviewUri() |
| `.nitro` extraction gives wrong binary format | MEDIUM | MEDIUM | Validate extraction output against Retrosprite; check BigEndian header |
| Classic v14 furniture missing from nitro-assets | MEDIUM | MEDIUM | Inspect each required item visually before committing; fallback to modern equivalent |
| Multi-tile furniture depth sort fails | MEDIUM | LOW | Use farthest-tile sort key for multi-tile items; validate with 2×2 desk placement |
| Sulake DMCA for assets in public repo | LOW | HIGH | Keep extracted assets in private storage; never commit Sulake IP to public repo |
| Habbo sound effects copyright enforcement | LOW | LOW | Personal tool only; no distribution; convert to OGG to avoid MP3 codec issues regardless |
| Canvas HiDPI blurry rendering | HIGH | MEDIUM | Apply devicePixelRatio scaling at canvas init; set imageSmoothingEnabled=false |
| PNG atlas first-draw hitch | MEDIUM | MEDIUM | Pre-decode with createImageBitmap after load; store ImageBitmap in sprite cache |
| `ctx.save()/restore()` loop overhead | MEDIUM | LOW | Set render state once per draw pass, not per sprite |
| localResourceRoots misconfigured, assets 404 | MEDIUM | HIGH | Always include extensionUri in localResourceRoots; test asset loading early |
| React re-render destroys canvas context | LOW | HIGH | Wrap canvas component in React.memo; use useRef for all game state |

---

## Sources

### Primary (HIGH confidence — official sources)
- VS Code Webview API docs: [code.visualstudio.com/api/extension-guides/webview](https://code.visualstudio.com/api/extension-guides/webview) — CSP, localResourceRoots, asWebviewUri, audio codec status
- GitHub issue [#66050](https://github.com/microsoft/vscode/issues/66050) — "Audio is not supported in webview" (confirmed by VS Code team)
- GitHub issue [#54097](https://github.com/microsoft/vscode/issues/54097) — "We don't ship ffmpeg so many common audio and video formats are not supported" (VS Code team quote)
- GitHub issue [#87282](https://github.com/microsoft/vscode/issues/87282) — Web Workers blocked in webviews (vscode-resource cross-origin)
- esbuild Content Types docs: [esbuild.github.io/content-types/](https://esbuild.github.io/content-types/) — loader behaviours, binary/dataurl/file/copy loader specifics
- GitHub DMCA repo: [github/dmca — Sulake 2015](https://github.com/github/dmca/blob/master/2015/2015-03-08-Sulake.md) — only documented GitHub DMCA by Sulake
- React StrictMode docs: [react.dev/reference/react/StrictMode](https://react.dev/reference/react/StrictMode) — double-mount behaviour confirmed

### Secondary (MEDIUM confidence — verified against official sources or multiple sources)
- GitHub issue [#148494](https://github.com/microsoft/vscode/issues/148494) — AudioContext.decodeAudioData MP3 error in VS Code
- GitHub issue [#2707](https://github.com/microsoft/vscode-discussions/discussions/2707) — localResourceRoots misconfiguration causes 401
- React issues [#25614](https://github.com/facebook/react/issues/25614), [#30835](https://github.com/facebook/react/issues/30835) — StrictMode cleanup bug with refs
- esbuild issue [#459](https://github.com/evanw/esbuild/issues/459) — publicPath dynamic resolution limitation
- sphynxkitten/nitro-assets README — asset category listing and maintainer completeness note
- MDN Optimizing Canvas: [developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

### Tertiary (LOW confidence — single source or community reports)
- DevBest community thread on Sulake DMCA patterns — enforcement focus on monetisation rather than personal tools
- [vscode-audio-preview](https://github.com/sukumo28/vscode-audio-preview) — WAV/OGG confirmed working via WASM decoder; implies pure-browser codec path works where ffmpeg is absent
- Trail of Bits VSCode security blog (2023) — CSP enforcement scope and webview isolation details
