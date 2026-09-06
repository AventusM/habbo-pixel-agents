# S01: Standalone Room Renderer

**Goal:** Extract the Canvas 2D Habbo room renderer from the VS Code webview into a standalone browser page served by a local dev server.
**Demo:** Running `npm run web` starts a local server. Opening `http://localhost:3000` shows the isometric room with floor, walls, furniture, camera controls (pan/zoom), and a demo avatar walking around.

## Must-Haves

- Room renders identically to the VS Code webview (floor, walls, furniture, camera pan/zoom)
- At least one demo avatar spawns and animates (walk, idle)
- Asset loading uses relative URLs (no VS Code webview URIs)
- VS Code extension continues to work unchanged (no breaking changes to existing files)
- Shared rendering code — no duplication of RoomCanvas, renderers, or math modules

## Proof Level

- This slice proves: integration (renderer works outside VS Code with same visual output)
- Real runtime required: yes (browser + dev server)
- Human/UAT required: yes (visual correctness)

## Verification

- `npm run build:web` completes without errors
- `npm run web` starts server, `curl -s http://localhost:3000 | grep -q '<canvas'` or page loads
- Browser at localhost:3000 shows room with floor tiles, walls, furniture, and a walking avatar
- `npm run build` (existing VS Code build) still succeeds
- `npx vitest run` existing tests still pass

## Tasks

- [x] **T01: Standalone web entry point and HTML shell** `est:1h`
  - Why: Replace VS Code webview bootstrapping with a standalone HTML page and entry script that sets ASSET_URIS with relative paths
  - Files: `src/web/main.tsx`, `src/web/index.html`, `esbuild.config.mjs`
  - Do: Create `src/web/main.tsx` mirroring `webview.tsx` but using relative `/assets/` paths for ASSET_URIS. Create `src/web/index.html` with font preload, styles, and root div. Add `build:web` target to esbuild that bundles `src/web/main.tsx` and copies index.html + assets to `dist/web/`. Guard `vscodeApi` calls in RoomCanvas with existing null checks (already done).
  - Verify: `npm run build:web` succeeds, `dist/web/index.html` and `dist/web/main.js` exist
  - Done when: Web build produces a complete dist/web/ directory with HTML, JS, and all assets

- [x] **T02: Dev server and demo avatar** `est:45m`
  - Why: Need a local server to serve assets (can't use file:// for fetch/font loading). Demo avatar proves the full avatar pipeline works standalone.
  - Files: `src/web/main.tsx`, `src/web/demoData.ts`, `package.json`
  - Do: Add a lightweight dev server script (`scripts/web-server.mjs`) using Node's built-in http module to serve `dist/web/` on port 3000. Add `npm run web` script that builds then serves. Create `src/web/demoData.ts` that dispatches `extensionMessage` events to spawn a demo avatar, set it active, trigger tool text updates — exercising the existing message protocol.
  - Verify: `npm run web`, open browser, room renders with floor/walls/furniture/demo avatar
  - Done when: localhost:3000 shows the complete room with a walking, animating demo avatar

- [x] **T03: Verify no regressions and commit** `est:15m`
  - Why: Ensure existing VS Code extension build and tests are unaffected
  - Files: none (verification only)
  - Do: Run existing build, run existing tests, verify no changes to src/webview.tsx or src/RoomCanvas.tsx beyond safe null-guard additions
  - Verify: `npm run build` succeeds, `npx vitest run` passes
  - Done when: All existing builds and tests pass, no functional changes to extension code

## Files Likely Touched

- `src/web/main.tsx` (new)
- `src/web/index.html` (new)
- `src/web/demoData.ts` (new)
- `scripts/web-server.mjs` (new)
- `esbuild.config.mjs` (add web build target)
- `package.json` (add npm scripts)
