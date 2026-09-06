---
status: complete
started: 2026-03-21
completed: 2026-03-21
---

# S01 Summary: Standalone Room Renderer

## What Was Done

Extracted the Canvas 2D Habbo room renderer from the VS Code webview into a standalone browser page served by a local dev server.

### Files Created
- `src/web/main.tsx` — Standalone entry point mirroring `webview.tsx` with relative `/assets/` paths instead of VS Code webview URIs
- `src/web/index.html` — HTML shell with font preload, styles, and root div
- `src/web/demoData.ts` — Demo agent simulator that dispatches `extensionMessage` events to spawn 3 avatars (Alice/core-dev, Bob/planning, Carol/infrastructure) with tool text cycling
- `scripts/web-server.mjs` — Lightweight dev server using Node's built-in `http` module, proper MIME types, directory traversal prevention, SPA fallback

### Files Modified
- `esbuild.config.mjs` — Added `webStandaloneConfig` build target and `copyWebAssets()` function for `build:web`
- `package.json` — Added `build:web`, `web`, `web:serve` npm scripts

### Key Design Decisions
- **Shared code, not duplicated**: `src/web/main.tsx` imports `RoomCanvas`, `SpriteCache`, and `roomLayoutEngine` directly from the existing codebase — no code duplication
- **Same message protocol**: Demo data uses the same `extensionMessage` CustomEvent pattern as the VS Code extension, so `RoomCanvas.tsx` works unchanged
- **Zero changes to existing files**: `src/webview.tsx` and `src/RoomCanvas.tsx` untouched — `vscodeApi` calls already had null guards
- **No new dependencies**: Dev server uses Node's built-in `http` module

## Verification Results
- `npm run build:web` → succeeds, produces `dist/web/` with index.html, main.js, and all assets
- `npm run web` → starts server at localhost:3000, room renders with floor/walls/furniture/demo avatars
- `npm run build` → existing VS Code extension build still succeeds
- `npx vitest run` → 373 tests pass across 25 test files, zero regressions

## Risk Retired
**Renderer extraction** — the Canvas 2D room renderer works identically in a standalone browser page. No VS Code dependencies leak into the shared rendering code.
