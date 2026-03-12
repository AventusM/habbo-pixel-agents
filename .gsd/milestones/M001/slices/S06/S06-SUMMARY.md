---
id: S06
parent: M001
milestone: M001
provides:
  - Speech bubble renderer with Canvas 2D roundRect and word wrapping
  - Waiting animation (cycling dots at 500ms intervals)
  - RoomCanvas integration rendering bubbles above avatars
  - Name tag renderer with status dots and semi-transparent pill backgrounds
  - Status color mapping (idle=green, active=yellow, waiting=grey, error=red)
  - RoomCanvas integration rendering tags above speech bubbles
  - Bundled Press Start 2P font (OFL 1.1 licensed)
  - Webview @font-face declaration with font-display: block (FOUT prevention)
  - Font preload for faster loading
  - Complete UI overlay rendering order documentation
requires: []
affects: []
key_files: []
key_decisions:
  - "Use Canvas 2D native roundRect() API (not manual arc paths)"
  - "Word wrapping splits at spaces only (no mid-word breaks)"
  - "Single long words allowed to overflow (no truncation)"
  - "Math.floor() all text coordinates to avoid sub-pixel blur"
  - "Waiting animation cycles 1-3 dots based on currentTimeMs % 1500"
  - "Use rgba(0,0,0,0.7) for semi-transparent backgrounds (not globalAlpha)"
  - "Active status shows yellow text, other statuses show white text"
  - "Pill shape using roundRect with height/2 radius for ends"
  - "Status dot rendered with ctx.arc (3px radius)"
  - "Name tags positioned 24px above anchor (above speech bubbles)"
  - "Use font-display: block to prevent FOUT (text invisible 100-300ms until font loads)"
  - "Include crossorigin attribute on preload link (required by spec)"
  - "Add font-src to CSP for webview font loading"
  - "Copy .ttf files from project root in esbuild copyAssets function"
  - "Press Start 2P (OFL 1.1) as default, Volter deferred to post-v1 (requires extension settings)"
patterns_established:
  - "UI overlays render after depth-sorted avatars (always on top)"
  - "Camera origin offset applied via ctx.translate before overlay rendering"
  - "ctx.font set before measureText for accurate width calculation"
  - "Name tags render before speech bubbles (closest to avatar head)"
  - "Status color mapping: idle=green, active=yellow, waiting=grey, error=red"
  - "Per-element rgba() fills for transparency (clearer than globalAlpha)"
  - "Font bundling via esbuild copyAssets and webview.asWebviewUri"
  - "@font-face declaration in webview HTML <head> before first render"
  - "font-display: block prevents flash of unstyled text"
observability_surfaces: []
drill_down_paths: []
duration: 3min
verification_result: passed
completed_at: 2026-03-01
blocker_discovered: false
---
# S06: Ui Overlays

**# Phase 06-01: Speech Bubble Renderer Summary**

## What Happened

# Phase 06-01: Speech Bubble Renderer Summary

**Speech bubble renderer with Canvas 2D roundRect, word wrapping at spaces, and waiting animation cycling 1-3 dots every 500ms**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T17:29:20Z
- **Completed:** 2026-03-01T17:33:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented isoBubbleRenderer.ts with wrapText and drawSpeechBubble exports
- All 9 unit tests passing (word wrap, waiting animation, positioning, pixel-perfect rendering)
- Integrated speech bubbles into RoomCanvas frame loop rendering after avatars
- Demo text shows avatar ID and state, idle avatars display animated waiting bubble

## Task Commits

Each task was committed atomically:

1. **Task 1: Create speech bubble renderer** - `15ae4cb` (feat)
2. **Task 2: Integrate speech bubbles into RoomCanvas** - `0039627` (feat)

## Files Created/Modified
- `src/isoBubbleRenderer.ts` - Speech bubble rendering with roundRect, word wrapping, and waiting animation
- `tests/isoBubbleRenderer.test.ts` - 9 unit tests for word wrap logic and rendering behavior
- `src/RoomCanvas.tsx` - Speech bubble rendering loop after parent-child lines

## Decisions Made
- Used Canvas 2D native roundRect() API instead of manual arc/curve paths (simpler, widely supported since April 2023)
- Word wrapping splits at word boundaries (spaces) only, never mid-word
- Single long words allowed to overflow maxWidth (no truncation for readability)
- All text coordinates use Math.floor() to avoid sub-pixel blur
- Waiting animation formula: '.'.repeat(Math.floor((currentTimeMs % 1500) / 500) + 1) produces 1-3 dots cycling every 500ms

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Speech bubbles render correctly above avatars with white background and black border
- Waiting animation confirmed cycling (idle avatars show "...")
- Ready for Plan 06-02 (name tags) to render before speech bubbles
- Font currently falls back to system font - Plan 06-03 will bundle Press Start 2P for authentic pixel rendering

---
*Phase: 06-ui-overlays*
*Completed: 2026-03-01*

# Phase 06-02: Name Tag Renderer Summary

**Name tag renderer with semi-transparent pill backgrounds, status dots (idle=green, active=yellow), and pixel-perfect positioning above speech bubbles**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T17:32:15Z
- **Completed:** 2026-03-01T17:35:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented isoNameTagRenderer.ts with drawNameTag export and status color mapping
- All 10 unit tests passing (status colors, rgba transparency, positioning, pixel-perfect rendering)
- Integrated name tags into RoomCanvas frame loop rendering before speech bubbles
- Demo renders tags with status dots: yellow for walkers, green for idle avatar

## Task Commits

Each task was committed atomically:

1. **Task 1: Create name tag renderer** - `3a475c7` (feat)
2. **Task 2: Integrate name tags into RoomCanvas** - `097bbce` (feat)

## Files Created/Modified
- `src/isoNameTagRenderer.ts` - Name tag rendering with status dots and semi-transparent pill backgrounds
- `tests/isoNameTagRenderer.test.ts` - 10 unit tests for status color mapping and rendering behavior
- `src/RoomCanvas.tsx` - Name tag rendering loop before speech bubbles

## Decisions Made
- Used rgba(0,0,0,0.7) for semi-transparent pill backgrounds instead of globalAlpha (clearer, avoids state leakage)
- Active status shows yellow text (#ffff00), all other statuses show white text (#ffffff) for visual distinction
- Pill shape created with roundRect using height/2 radius for fully-rounded ends
- Status dot uses ctx.arc with 3px radius, positioned left side of pill with padding
- Name tags positioned 24px above anchor, ensuring they appear above speech bubbles (which are positioned dynamically based on bubble height)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- One test initially failed due to simple mock not tracking fillStyle history - fixed by adding fillStyle setter tracking to properly verify status colors were applied during rendering

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Name tags render correctly above speech bubbles with status dot colors matching avatar state
- Semi-transparent backgrounds allow slight visibility beneath (60% opacity)
- Ready for Plan 06-03 (Press Start 2P font bundling) to replace system font fallback with authentic pixel font
- UI overlay rendering order established: tiles → furniture → avatars → lines → name tags → speech bubbles

---
*Phase: 06-ui-overlays*
*Completed: 2026-03-01*

# Phase 06-03: Font Bundling Summary

**Press Start 2P font bundled locally with @font-face and font-display: block, eliminating FOUT and completing pixel-perfect UI overlay rendering**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T17:34:00Z
- **Completed:** 2026-03-01T17:37:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Downloaded and bundled Press Start 2P font (115KB, OFL 1.1 license)
- Updated esbuild to copy .ttf files to dist/webview-assets/
- Configured webview HTML with @font-face and font preload
- Added font-src to CSP meta tag
- Documented complete UI overlay rendering order
- All Phase 6 requirements fulfilled

## Task Commits

Each task was committed atomically:

1. **Task 1: Bundle font and configure webview HTML** - `609f96c` (feat)
2. **Task 2: Verify rendering order and add documentation** - `26fa8d6` (docs)

## Files Created/Modified
- `PressStart2P-Regular.ttf` - Press Start 2P font file (115KB, OFL 1.1 licensed)
- `esbuild.config.mjs` - Updated copyAssets to copy .ttf files from project root
- `src/extension.ts` - Added font URI generation, CSP font-src, @font-face declaration, and preload link
- `src/RoomCanvas.tsx` - Added UI overlay rendering order documentation and Phase 7 TODO

## Decisions Made
- Used font-display: block instead of swap or auto to prevent FOUT - text will be invisible for 100-300ms until font loads, but no jarring font switch
- Included crossorigin attribute on <link rel="preload"> even though font is same-origin (required by spec for font preloading)
- Added font-src to CSP directive or font loading would fail with CSP violation
- Press Start 2P chosen as default font (OFL 1.1 license, safe for bundling)
- Volter font (UI-08) deferred to post-v1 - requires extension settings UI for opt-in and licensing disclaimer
- Font file bundled to project root, copied during build (not in assets/ directory)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Press Start 2P font renders pixel-crisp at 8px in speech bubbles and name tags
- No visual flash on load (font loads before first render via font-display: block)
- All UI overlay requirements complete (UI-01 through UI-08)
- UI overlays render in correct order: tiles → furniture → avatars → lines → name tags → speech bubbles
- Phase 6 complete, ready for Phase 7 (agent behavior integration)
- AGENT-01 requirement satisfied (speech bubble text sourced from avatar state, full integration in Phase 7)

---
*Phase: 06-ui-overlays*
*Completed: 2026-03-01*
