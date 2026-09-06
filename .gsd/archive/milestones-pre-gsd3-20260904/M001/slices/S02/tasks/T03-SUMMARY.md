---
id: T03
parent: S02
milestone: M001
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 2026-02-28T21:16:00Z
blocker_discovered: false
---
# T03: 02-static-room-rendering 03

**# Phase 02 Plan 03: React Component + VS Code Extension**

## What Happened

# Phase 02 Plan 03: React Component + VS Code Extension

React component with StrictMode-safe rAF loop, VS Code extension host entry point, webview browser entry, and esbuild bundling — producing a demo-able isometric room renderer.

## Implementation Summary

### Task 1: Implement RoomCanvas.tsx with StrictMode-safe rAF loop
**Commit:** cf88cad

Created React component with canvas rendering and requestAnimationFrame loop that survives React StrictMode double-mount.

**Component structure:**

1. **Props interface:**
   - `heightmap: string` - Habbo heightmap string triggering re-render on change

2. **Refs (all useRef — NO useState):**
   - `canvasRef` - HTMLCanvasElement reference
   - `runningRef` - boolean guard for rAF loop (prevents ghost loops)
   - `rafIdRef` - requestAnimationFrame ID for cleanup
   - `renderState` - object containing offscreenCanvas, cameraOrigin, mainCtx

3. **useEffect with [heightmap] dependency:**
   - Gets canvas element from ref
   - Calls `initCanvas()` to set up HiDPI scaling
   - Parses heightmap via `parseHeightmap()`
   - Computes camera origin for room centering
   - Pre-renders room to OffscreenCanvas
   - Starts rAF loop with `runningRef.current = true`
   - Cleanup sets `runningRef.current = false` BEFORE `cancelAnimationFrame()`

4. **frame() function:**
   - **FIRST LINE:** `if (!runningRef.current) return` - StrictMode guard
   - Clears canvas
   - Blits OffscreenCanvas via single `drawImage()` call
   - Schedules next frame

**StrictMode safety verified:** No ghost loops observed in development (React 19 StrictMode double-mount).

**Verification:** npm run typecheck exits 0, RoomCanvas exports named export, no useState in file.

### Task 2: Bootstrap extension.ts and webview.tsx with esbuild build scripts
**Commit:** f895b46

Created VS Code extension host entry point and React webview browser entry.

**extension.ts (Node.js context):**
- Declares DEMO_HEIGHTMAP constant (10×10 office room with stair-step)
- Registers command `habbo-pixel-agents.openRoom`
- Creates WebviewPanel with:
  - `enableScripts: true`
  - `localResourceRoots: [context.extensionUri/dist]`
  - CSP: `script-src ${webview.cspSource}; style-src 'unsafe-inline'`
- Builds scriptUri via `webview.asWebviewUri()`
- Sets HTML shell with root div and script tag

**webview.tsx (browser context):**
- Imports React, createRoot, RoomCanvas
- Declares same DEMO_HEIGHTMAP
- Calls `createRoot(document.getElementById('root')!).render(<RoomCanvas heightmap={DEMO_HEIGHTMAP} />)`

**Build scripts:**
- `build:ext` - esbuild with `--platform=node --external:vscode --format=cjs --outfile=dist/extension.cjs`
- `build:webview` - esbuild with `--platform=browser --format=iife --jsx=automatic --outfile=dist/webview.js`
- `build` - runs both in sequence

**package.json updates:**
- `main: "./dist/extension.cjs"` (changed from .js to .cjs for ESM compatibility)
- `engines.vscode: "^1.80.0"`
- `contributes.commands` with `habbo-pixel-agents.openRoom`

**VS Code debug config:**
- Created `.vscode/launch.json` with `type: extensionHost`
- Created `.vscode/tasks.json` with `npm: build` task
- Added `preLaunchTask: "npm: build"` to auto-build before F5

**Verification:** npm run build exits 0, dist/extension.cjs and dist/webview.js exist and non-empty.

### Task 3: Visual verification — isometric room renders in VS Code webview
**Status:** APPROVED by user on 2026-02-28T21:16:00Z

**Testing procedure:**
1. Built extension via `npm run build` - ✓ SUCCESS
2. Launched Extension Development Host via F5 - ✓ SUCCESS
3. Ran "Open Habbo Room" command - ✓ SUCCESS
4. Visual inspection of webview panel - ✓ ALL CRITERIA MET

**Verification results:**

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Diamond-shaped isometric floor tiles (not rectangles) | ✓ VERIFIED | Screenshot shows correct rhombus-shaped tiles |
| Stair-step tiles visually elevated | ✓ VERIFIED | Four height-1 tiles in upper area render higher than ground level |
| Three-tone shading (top/left/right faces) | ✓ VERIFIED | Top face lightest, left face medium, right face darkest |
| Left and right wall strips along room edges | ✓ VERIFIED | Parallelogram wall faces visible on edges |
| Room centered in panel | ✓ VERIFIED | Room bounding box centered in viewport |
| Crisp pixels on HiDPI display | ✓ VERIFIED | Tile edges sharp, no blur artifacts |
| No console errors from extension code | ✓ VERIFIED | Only VS Code/Copilot internal errors present, no errors mentioning habbo/RoomCanvas/isoTileRenderer |

**Console errors found:**
- `punycode` module deprecation warning (VS Code internal)
- SQLite experimental feature warning (VS Code internal)
- GitHub Copilot 404 errors (unrelated service)
- TreeError [DebugRepl] (VS Code debugger internal)

None of these errors originate from the Habbo extension code. The extension functions correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] CommonJS vs ESM module format conflict**
- **Found during:** Task 2 F5 launch attempt
- **Issue:** Extension built as CommonJS (format=cjs) but output as .js; with package.json type=module, Node treats .js as ESM, causing "module is not defined in ES module scope" error
- **Fix:** Changed build:ext output to dist/extension.cjs and updated package.json main field to ./dist/extension.cjs
- **Files modified:** package.json (main field, build:ext script)
- **Commit:** Not committed separately (fixed during Task 2 debugging)

**2. [Rule 2 - Missing Configuration] VS Code launch.json misconfigured for Chrome debugging**
- **Found during:** Task 3 F5 launch attempt
- **Issue:** Default launch.json configured for Chrome/web debugging (type: chrome), not extension host; caused "Unable to find browser" error
- **Fix:** Replaced launch.json with extensionHost configuration, added preLaunchTask for auto-build
- **Files modified:** .vscode/launch.json (replaced), .vscode/tasks.json (created)
- **Commit:** Not committed separately (fixed during Task 3 debugging)

## Requirements Fulfilled

- **ROOM-10:** React StrictMode-safe rAF loop implemented (runningRef guard pattern prevents ghost loops)
- **ROOM-11:** VS Code extension entry points created (extension.ts for host, webview.tsx for browser)
- **BUILD-01:** esbuild bundling configured (extension.cjs for Node, webview.js for browser)
- **BUILD-02:** localResourceRoots and asWebviewUri() wired correctly (no 401/Access Denied errors)
- **BUILD-03:** Extension debuggable via F5 with auto-build preLaunchTask

## Technical Notes

### StrictMode Double-Mount Safety

React 19 StrictMode mounts components twice in development to catch side effects. The rAF loop survives this via:

```typescript
const runningRef = useRef(false);

useEffect(() => {
  runningRef.current = true;

  const frame = () => {
    if (!runningRef.current) return;  // Guard FIRST
    // ... render logic ...
    rafIdRef.current = requestAnimationFrame(frame);
  };

  rafIdRef.current = requestAnimationFrame(frame);

  return () => {
    runningRef.current = false;  // Set BEFORE cancel
    cancelAnimationFrame(rafIdRef.current);
  };
}, [heightmap]);
```

**Key details:**
- `runningRef.current = false` happens BEFORE `cancelAnimationFrame()` in cleanup
- `if (!runningRef.current) return` is the FIRST statement in `frame()`
- This ordering ensures no race conditions during StrictMode double-mount/unmount

### Extension vs Webview Context Separation

- **extension.ts** runs in Node.js (extension host process) - has access to `vscode` API, no DOM
- **webview.tsx** runs in browser (sandboxed iframe) - has DOM/React, no `vscode` API
- Communication between them happens via `webview.postMessage()` / `webview.onDidReceiveMessage()` (not used in this phase)

### CommonJS .cjs Extension Requirement

With `"type": "module"` in package.json:
- `.js` files are treated as ES modules
- `.cjs` files are treated as CommonJS
- VS Code extensions are CommonJS by convention (cannot use ESM yet)
- Solution: output extension bundle as `.cjs` to avoid module format errors

## Next Steps

Phase 2 (Static Room Rendering) is **COMPLETE**. All 3 plans (02-01, 02-02, 02-03) are done:
- ✓ Pure types, parser, colour utilities, depth sort (02-01)
- ✓ Canvas drawing module with HiDPI and OffscreenCanvas (02-02)
- ✓ React component and VS Code extension (02-03)

**Phase 2 deliverables achieved:**
- ✓ Isometric floor rhombuses drawn at correct positions
- ✓ Stair-step height offsets rendered visually
- ✓ Three-tone HSL shading (top/left/right faces)
- ✓ Left and right wall strips on room edges
- ✓ Depth-sorted back-to-front rendering
- ✓ OffscreenCanvas pre-rendering with single blit per frame
- ✓ HiDPI scaling with pixel-crisp rendering
- ✓ StrictMode-safe rAF loop (no ghost loops)
- ✓ Demo-able VS Code extension

**Next phase:** Phase 3 (Asset Pipeline) - `.nitro` extraction script, sprite cache, ImageBitmap loading, webview asset URI pipeline.

## Verification Results

```bash
npm run typecheck
✓ No TypeScript errors across all src/ files

npm run build
✓ dist/extension.cjs: 2.8kb
✓ dist/webview.js: 1.1mb

F5 → Open Habbo Room
✓ Isometric room renders correctly
✓ All 6 visual criteria met
✓ No extension-related console errors
```

All success criteria met:
- [x] npm run build exits 0 producing dist/extension.cjs and dist/webview.js
- [x] npm run typecheck exits 0 across all src/ files
- [x] VS Code webview opens on "Open Habbo Room" command
- [x] Isometric room visible with floor tiles, stair steps, wall strips, three-tone shading
- [x] rAF loop runs with no ghost loops under React StrictMode
- [x] All mutable state in RoomCanvas.tsx is in useRef (code review confirmed)
- [x] Camera origin policy locked (room centered via computeCameraOrigin)
- [x] WALL_HEIGHT=128 constant exists in isoTileRenderer.ts
- [x] All ROOM-01 through ROOM-11 requirements satisfied

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| `cf88cad` | feat(02-03): implement RoomCanvas.tsx with StrictMode-safe rAF loop | src/RoomCanvas.tsx |
| `f895b46` | feat(02-03): bootstrap VS Code extension with esbuild build scripts | src/extension.ts, src/webview.tsx, package.json updates |

---

_Completed: 2026-02-28T21:16:00Z_
_Visual verification: APPROVED_
_Phase 2 Status: COMPLETE_
