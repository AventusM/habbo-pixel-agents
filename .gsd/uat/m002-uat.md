# M002 UAT — Restore Original Habbo Figure Avatar System

- Date: 2026-09-10
- Source revision: `42db22d` (origin/main)
- Environment: darwin, Node v22.22.1, local web server at http://localhost:3000, Paseo browser (Chromium)
- Assets: local-only (`assets/habbo/figures`), 21/21 figure items loaded

## Checks

### 1. Renderer selection — PASS
- Client log: `[Avatars] Renderer: Habbo`
- Bootstrap: `figures=21/21 | figuresAvailable=true`
- Status chip: `figures: local`
- No console errors.

### 2. Eight-direction walking in the room — PASS (owner-approved)
- Loaded `http://localhost:3000/?demo`; demo agents spawned: Alice (core-dev), Bob (planning), Carol (infrastructure).
- Canvas 1280x800, renderer Habbo.
- Frame diff over 1200ms: **29,336 changed pixels** (agents animating/walking).
- Console errors: none.

### 3. AvatarDebugGrid — PASS
- Loaded `http://localhost:3000/?debuggrid=1`.
- Canvas 540x1000 sprite-sheet view; 540,000 opaque pixels; 184 distinct colors.
- Log: `Rendering AvatarDebugGrid (sprite-sheet debug view)`; `Close` present.

### 4. Test suite + build — PASS
- `npx vitest run` — 605 passed / 38 files.
- Renderer + outfit config: 58 passed.
- `node esbuild.config.mjs web` — `dist/web/main.js` + `dist/web/server.mjs` built, assets copied.
