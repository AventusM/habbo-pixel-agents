---
id: T01
parent: S05
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
completed_at: 
blocker_discovered: false
---
# T01: 05-avatar-system 01

**# Phase 5 Plan 01: Avatar Renderer with Placeholder Sprites**

## What Happened

# Phase 5 Plan 01: Avatar Renderer with Placeholder Sprites

**One-liner:** Implemented 8-direction avatar renderer with 4-layer composition and 6 palette variants using ImageMagick-generated placeholder sprites (192 total frames).

## Overview

Created the avatar rendering system following the same patterns as furniture rendering from Phase 4, but adapted for 8-direction support (no mirroring) and multi-layer sprite composition. Generated placeholder sprites demonstrating all directions and variants, then integrated into the VS Code webview with 8 test avatars showing visual diversity.

## What Was Built

### Task 1: Avatar Renderer Module (5528ddf)

**Implemented:** `src/isoAvatarRenderer.ts`

- **AvatarSpec interface** with 8 directions (0-7), 6 variants (0-5), state ('idle' | 'walk'), and frame number
- **createAvatarRenderable function** returning Renderable with multi-layer composition:
  - Renders 4 layers in order: body → clothing → head → hair
  - Frame key format: `avatar_{variant}_{layer}_{direction}_{state}_{frame}`
  - No horizontal mirroring (all 8 directions use unique sprites)
  - Graceful degradation: skips missing layers without crashing
  - Debug logging (once per avatar ID)

**Why 8 directions without mirroring:** Furniture uses 4 directions with horizontal mirrors because office furniture is symmetrical. Avatars need 8 unique directions because characters are asymmetric (different arm/leg positions when walking diagonally).

**Test coverage:** 7 smoke tests in `tests/isoAvatarRenderer.test.ts`
- AvatarSpec interface exists with all required fields ✓
- createAvatarRenderable returns correct tileX/tileY/tileZ ✓
- Graceful degradation when sprite cache empty ✓
- All 8 directions produce unique frame lookups ✓
- All 6 variants produce unique frame lookups ✓
- Idle vs walk state produces different frame keys ✓
- Multi-layer composition loop doesn't crash ✓

**Deviations:**
- Added `src/global.d.ts` type declarations for window debug properties (TypeScript compilation fix)
- Updated `tests/setup.ts` to mock window object in Node test environment (test execution fix)

### Task 2: Placeholder Avatar Sprite Generation (405a81c)

**Implemented:** `scripts/generate-avatar-placeholders.sh`

- Generates 192 sprites: 6 variants × 8 directions × 4 layers × 1 state (idle)
- Each sprite 96×128px (taller than furniture to represent human figure)
- 6 distinct color schemes:
  - Variant 0: RED body, BLUE hair
  - Variant 1: CYAN body, ORANGE hair
  - Variant 2: GREEN body, YELLOW hair
  - Variant 3: MAGENTA body, WHITE hair
  - Variant 4: ORANGE body, CYAN hair
  - Variant 5: BLUE body, GREEN hair

**Layer rendering:**
- Body: Solid colored oval (torso)
- Clothing: 20% darker shade of body color (shirt)
- Head: Wheat-colored circle (face)
- Hair: Distinct colored rectangle (hairstyle)
- Direction indicator: White number (0-7) overlaid on body layer

**Output:**
- `assets/spritesheets/avatar_atlas.png` (99KB, 1536×1536px, 16×12 sprite grid)
- `assets/spritesheets/avatar_atlas.json` (48KB, Texture Packer hash format, 192 frame entries)

**ImageMagick approach:** Used `convert` command to generate geometric shapes programmatically. Montage command assembled sprites into grid atlas.

### Task 3: Webview Integration (babf518)

**Modified files:**
1. **src/extension.ts** — Added avatar atlas URIs to window.ASSET_URIS
2. **src/webview.tsx** — Load avatar atlas before React render, test frame lookup
3. **src/RoomCanvas.tsx** — Create 8 test avatars, render with depth sorting

**Test avatars placed:**
- 8 avatars at different positions demonstrating all 6 variants and 8 directions
- Positioned to avoid furniture overlap for clear visibility
- Examples:
  - av0: Variant 0 (red/blue), Direction 0 (NE) at (2,2,0)
  - av1: Variant 1 (cyan/orange), Direction 1 (E) at (4,2,0)
  - av7: Variant 1, Direction 7 (N) at (4,6,0)

**Rendering approach:**
- Avatars NOT pre-rendered to offscreen canvas (unlike static furniture)
- Created as Renderables with camera offset wrapper
- Rendered in frame loop after blitting static room geometry
- Depth-sorted for correct overlap with tiles/furniture

**Build integration:** esbuild config already copies .png/.json from assets/spritesheets/ to dist/webview-assets/ (established in Phase 3).

## Deviations from Plan

### Auto-Fixed Issues (Deviation Rules 1-3)

**1. [Rule 2 - Missing critical functionality] TypeScript type errors for window properties**
- **Found during:** Task 1 typecheck
- **Issue:** `window._debuggedAvatars` and `window._debuggedFurniture` not declared, causing TypeScript errors
- **Fix:** Created `src/global.d.ts` with Window interface augmentation
- **Files modified:** src/global.d.ts (new)
- **Commit:** 5528ddf

**2. [Rule 2 - Missing critical functionality] Window object missing in Node test environment**
- **Found during:** Task 1 test execution
- **Issue:** `ReferenceError: window is not defined` in tests using Node environment
- **Fix:** Added window object mock in `tests/setup.ts`
- **Files modified:** tests/setup.ts
- **Commit:** 5528ddf

**3. [Rule 1 - Bug] Bash associative array syntax incompatible with macOS bash 3**
- **Found during:** Task 2 script execution
- **Issue:** `declare -A` syntax not supported in macOS default bash 3
- **Fix:** Rewrote color scheme lookup using case statement function instead of associative array
- **Files modified:** scripts/generate-avatar-placeholders.sh
- **Commit:** 405a81c

## Visual Validation Results

**Build output:**
```
✓ Extension built: dist/extension.cjs
  ✓ Copied avatar_atlas.json
  ✓ Copied avatar_atlas.png
✓ Webview built: dist/webview.js
```

**Expected console output when running F5 → Open Habbo Room:**
```
Loading avatar atlas from: vscode-resource://...
✓ Avatar atlas loaded successfully
✓ Avatar frame lookup succeeded: { name: 'avatar_0_body_0_idle_0', x: 0, y: 0, w: 96, h: 128 }
Placing 8 avatars with 6 variants
✓ Rendering avatar av0 (variant 0, direction 0) at (2,2,0)
✓ Rendering avatar av1 (variant 1, direction 1) at (4,2,0)
...
```

**Visual expectations:**
- 8 avatars visible at different positions
- 6 distinct color combinations (red/blue, cyan/orange, green/yellow, magenta/white, orange/cyan, blue/green)
- Direction numbers (0-7) visible on avatar bodies
- Avatars depth-sorted correctly (behind/in front of tiles based on position)
- No CSP violations or asset loading errors

## Requirements Fulfilled

- **AVAT-01:** ✓ 8-direction rendering with unique sprites per direction (no mirroring)
- **AVAT-04:** ✓ 3-4 layer sprite composition (body, clothing, head, hair)
- **AVAT-06:** ✓ 6 palette variants produce visually distinct characters

## Next Steps for Plan 02

**Planned deliverables:**
1. Walk cycle animation (4 frames per direction)
2. Idle blink overlay (3-frame random trigger)
3. Matrix spawn/despawn effects
4. Animation frame advancing at 250ms per frame

**What's already in place:**
- AvatarSpec includes `state: 'idle' | 'walk'` and `frame: number` fields
- Frame key format supports state and frame: `avatar_{variant}_{layer}_{direction}_{state}_{frame}`
- Avatars render in frame loop (not pre-rendered), enabling per-frame updates

**What needs to be added:**
- Walk cycle sprite generation (4 additional frames per direction = 768 new sprites)
- Animation state machine (idle ↔ walk transitions)
- Frame timer (advance frame every 250ms when walking)
- Blink overlay system (random 3-frame trigger every 5-8 seconds)
- Matrix spawn/despawn column effects

## Self-Check: PASSED

**Created files exist:**
```bash
✓ FOUND: src/isoAvatarRenderer.ts
✓ FOUND: tests/isoAvatarRenderer.test.ts
✓ FOUND: src/global.d.ts
✓ FOUND: scripts/generate-avatar-placeholders.sh
✓ FOUND: assets/spritesheets/avatar_atlas.png
✓ FOUND: assets/spritesheets/avatar_atlas.json
```

**Commits exist:**
```bash
✓ FOUND: 5528ddf (Task 1)
✓ FOUND: 405a81c (Task 2)
✓ FOUND: babf518 (Task 3)
```

**Build artifacts exist:**
```bash
✓ FOUND: dist/webview-assets/avatar_atlas.png (99KB)
✓ FOUND: dist/webview-assets/avatar_atlas.json (48KB)
```

**Tests pass:**
```bash
✓ 7 tests passing in tests/isoAvatarRenderer.test.ts
✓ npm run typecheck exits 0
```

## Conclusion

Plan 05-01 successfully established the avatar rendering foundation with 8-direction support and multi-layer composition. Placeholder sprites demonstrate all variants and directions, providing visual validation before implementing real Habbo-style sprites in future phases. The rendering pipeline is ready for animation in Plan 02.
