# Habbo Pixel Agents — Copilot Instructions

## Project Overview

VS Code extension that visualizes Claude Code AI agents as animated Habbo Hotel characters in an isometric room. Built with TypeScript, React 19, Canvas 2D API, and esbuild.

- ESM-first codebase (`"type": "module"` in package.json)
- Node.js 22+ required

## Commands

```bash
# Build (extension host + webview)
node esbuild.config.mjs

# Run tests
npx vitest run

# Type-check
npx tsc --noEmit
```

Always run tests before committing. Always run the build to verify no errors.

## Architecture

Two compilation targets:
- **Extension host** (`src/extension.ts` → `dist/extension.cjs`): Node.js, CJS output
- **Webview** (`src/webview.tsx` → `dist/webview.js`): Browser, IIFE output, React 19

### Rendering Pipeline
- `src/isoTileRenderer.ts` — orchestrates all sub-renderers
- `src/isoFurnitureRenderer.ts` — furniture sprites with depth sorting
- `src/isoWallRenderer.ts` — wall strips
- `src/isoAvatarRenderer.ts` — 11-layer Habbo avatar composition
- `src/pixelLabAvatarRenderer.ts` — PixelLab character sprites
- `src/isoBubbleRenderer.ts` — speech bubbles
- `src/isoNameTagRenderer.ts` — name tags with status dots
- `src/isoKanbanRenderer.ts` — kanban sticky notes

### Key Modules
- `src/isoSpriteCache.ts` — PNG atlas loading, frame key resolution
- `src/furnitureRegistry.ts` — furniture catalog (FURNITURE_CATALOG array)
- `src/roomLayoutEngine.ts` — room layout generation, section placement
- `src/isometricMath.ts` — coordinate conversion formulas
- `src/agentManager.ts` — agent lifecycle and state machine

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/` | Extension and webview TypeScript source |
| `tests/` | Vitest test files |
| `assets/habbo/furniture/` | Converted Nitro furniture assets (PNG + JSON) |
| `assets/habbo/figures/` | Converted Nitro avatar assets |
| `assets/pixellab/furniture/` | PixelLab source PNGs |
| `scripts/` | Asset pipeline and build scripts |
| `.gsd/` | GSD workflow state (milestones, slices, decisions) |

## Furniture Asset Pipeline

To add or replace a furniture sprite:

1. Place the source PNG in `assets/pixellab/furniture/`
2. Run: `node scripts/pack-pixellab-furniture.mjs assets/pixellab/furniture/<name>.png <furniture-id> [options]`
3. Register in `src/furnitureRegistry.ts` (add to `FURNITURE_CATALOG`, optionally `CHAIR_IDS` or `RUG_IDS`)
4. Run `node esbuild.config.mjs` to copy assets to dist

Pack script options:
- `--bottom-offset=N` — pixels below tile center (default: 9, floor items: 5-11)
- `--dimensions=WxHxD` — tile footprint (default: 1x1x1)
- `--directions=N,...` — supported Habbo directions (default: 0)
- `--no-shadow` — skip shadow diamond
- `--no-icon` — skip icon generation

## Rendering Conventions

### Isometric Math
- Tile size: 64x32 pixels (2:1 diamond)
- `screenX = (tileX - tileY) * 32`
- `screenY = (tileX + tileY) * 16 - tileZ * 16`
- Depth sort key: `tileX + tileY + tileZ * 0.001` (Painter's algorithm)

### Direction System
Habbo uses 8 directions (clockwise from NE): 0=NE, 1=E, 2=SE, 3=S, 4=SW, 5=W, 6=NW, 7=N

Items MUST be placed with supported directions or they render nothing silently.

Direction mapping for sprites: `getBaseDirection()` maps 0→0, 2→2, 4→2(flip), 6→0(flip)

### Sprite Positioning
- Registration point: tile center (top vertex + TILE_H_HALF = 16px down)
- Furniture: `dx = screenX + offsetX`, `dy = screenY + TILE_H_HALF + offsetY`
- Figures: `dx = regX - offsetX`, `dy = regY - offsetY` (both subtract)
- Flip logic: XOR of `shouldMirrorSprite(direction)` and frame's `flipH`

## GSD Workflow

This project uses a structured development workflow. State is tracked in `.gsd/`:

- `.gsd/PROJECT.md` — project definition, constraints, vision
- `.gsd/REQUIREMENTS.md` — all requirements with statuses and IDs
- `.gsd/DECISIONS.md` — 100+ architectural decisions
- `.gsd/milestones/Mxxx/` — milestone directories with roadmaps and slices

### Slice Structure
```
.gsd/milestones/Mxxx/slices/Sxx/
  Sxx-PLAN.md        # Goal, must-haves, tasks, files
  tasks/
    T01-PLAN.md      # Task description, must-haves, files
    T01-SUMMARY.md   # What happened
  Sxx-SUMMARY.md     # YAML frontmatter + narrative
  Sxx-UAT.md         # Verification report
```

## Commit Convention

- Features: `feat(Mxxx/Sxx): description`
- Housekeeping: `chore(Mxxx): description`
- Quick fixes: `fix: description`

Always atomic commits per task. Run tests before committing.
