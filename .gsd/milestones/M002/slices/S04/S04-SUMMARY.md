---
id: S04
parent: M002
milestone: M002
provides:
  - KanbanCard type exported from agentTypes.ts
  - fetchKanbanCards function in githubProjects.ts
  - kanbanCards ExtensionMessage variant
  - VS Code settings schema for GitHub Projects configuration
  - Polling interval with clearInterval cleanup on panel dispose
requires: []
affects: []
key_files: []
key_decisions:
  - "Use execFileSync args array (not execSync shell string) to avoid GraphQL quoting issues"
  - "Write complex GraphQL to temp file with --input flag for items query"
  - "Silent fallback pattern: catch all errors and return [] — same as audio phase"
  - "kanbanPollId declared in same closure scope as setup block and dispose callback"
patterns_established:
  - "gh CLI integration: execFileSync with args array, temp file for complex queries"
  - "Polling cleanup: clearInterval before agentManager.dispose in panel.onDidDispose"
observability_surfaces: []
drill_down_paths: []
duration: 5min
verification_result: passed
completed_at: 2026-03-05
blocker_discovered: false
---
# S04: Room Walls Kanban Notes

**# Phase 12 Plan 01: Room Wall Panels Summary**

## What Happened

# Phase 12 Plan 01: Room Wall Panels Summary

Full-height isometric wall panels replacing per-tile wall strips, using a shared baseline to eliminate height-gap artifacts.

## What Was Built

- `src/isoWallRenderer.ts`: New module exporting `drawWallPanels()` — scans TileGrid for left and right wall edge tiles, computes a shared baseline for each wall side, draws parallelogram strips extending to that baseline, and draws a 4px corner post at tile (0,0)
- Updated `preRenderRoom` in `src/isoTileRenderer.ts` to call `drawWallPanels` before the depth-sorted floor tile loop and removed the per-tile `drawLeftFace`/`drawRightFace` calls from the renderable draw closures

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create isoWallRenderer.ts with wall geometry and tests | a71c48b | src/isoWallRenderer.ts, tests/isoWallRenderer.test.ts |
| 2 | Integrate wall panels into preRenderRoom, remove per-tile strips | c8fcfc5 | src/isoTileRenderer.ts, tests/setup.ts |

## Decisions Made

- **Wall panels before floor tiles:** Walls are drawn first on the OffscreenCanvas so the depth-sorted floor tiles (drawn after) naturally cover the bottom edges of wall strips — correct painter's algorithm layering with no extra z-sorting needed.
- **Shared baseline per wall side:** Each wall side (left / right) independently computes `max(sy + TILE_H + WALL_HEIGHT)` across all its edge tiles. This guarantees strips from high-elevation tiles still reach the same bottom as strips from low-elevation tiles — no gaps.
- **Parallelogram geometry:** Left wall strips shear left (maintaining the 2:1 isometric diamond angle). Bottom-left vertex is `(sx - TILE_W_HALF, baseline - TILE_H_HALF)` to preserve the parallelogram shear rather than dropping straight down.
- **Corner post via fillRect:** A 4px-wide rectangle at the tile (0,0) top vertex fills the V-notch between left and right wall panels at the back of the room.
- **Keep drawLeftFace/drawRightFace:** The per-tile helpers remain in `isoTileRenderer.ts` (no longer called from the tile loop) for potential future use in wall-mounted furniture rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OffscreenCanvas mock missing fillRect method**
- **Found during:** Task 2 verification (`npx vitest run tests/isoTileRenderer.test.ts`)
- **Issue:** The global OffscreenCanvas mock in `tests/setup.ts` did not include a `fillRect` method. When `drawWallPanels` was integrated into `preRenderRoom`, the corner post's `ctx.fillRect(...)` call threw `TypeError: ctx.fillRect is not a function`
- **Fix:** Added `fillRect: () => {}` to the mock context returned by `OffscreenCanvas.getContext()`
- **Files modified:** `tests/setup.ts`
- **Commit:** c8fcfc5

## Verification

- `npx vitest run` — 263 tests across 17 test files, all passing (14 new wall renderer tests + 249 existing)
- `npm run typecheck` — no TypeScript errors
- Visual verification: requires manual webview check to confirm walls appear as full-height panels

## Self-Check: PASSED

All files and commits verified:
- FOUND: src/isoWallRenderer.ts
- FOUND: tests/isoWallRenderer.test.ts
- FOUND: commit a71c48b (Task 1)
- FOUND: commit c8fcfc5 (Task 2)

# Phase 12 Plan 02: GitHub Projects Kanban Data Pipeline Summary

**GitHub Projects v2 kanban fetch via gh CLI graphql with VS Code settings, polling interval, and silent error fallback returning KanbanCard[] to webview**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T23:46:01Z
- **Completed:** 2026-03-05T23:51:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- KanbanCard interface and kanbanCards ExtensionMessage variant added to agentTypes.ts
- githubProjects.ts fetches project items via two-step gh api graphql (node ID lookup then items query) with temp file for the complex items GraphQL to avoid shell quoting issues
- Silent fallback returns [] on any error: gh not installed, auth failure, parse error
- Four VS Code settings exposed in package.json: owner, ownerType, projectNumber, pollIntervalSeconds
- extension.ts reads settings, does initial fetch + postMessage, sets up polling interval, and cleans up in panel.onDidDispose

## Task Commits

Each task was committed atomically:

1. **Task 1: KanbanCard type, githubProjects.ts fetch module, and message protocol extension** - `21af4e6` (feat)
2. **Task 2: VS Code settings and polling integration to extension.ts** - `2861dc2` (feat)

## Files Created/Modified
- `src/agentTypes.ts` - Added KanbanCard interface and kanbanCards ExtensionMessage variant
- `src/githubProjects.ts` - fetchKanbanCards: two-step gh graphql with temp file for items query, silent fallback
- `tests/githubProjects.test.ts` - 5 unit tests: error fallback, card parsing, no-status default, null-title default, user vs org query
- `src/extension.ts` - Added fetchKanbanCards import, settings read, initial fetch, polling, clearInterval dispose
- `package.json` - Added contributes.configuration with four githubProject settings

## Decisions Made
- Used execFileSync with args array (not execSync with shell string) to avoid GraphQL quoting issues with complex multi-line queries
- Wrote the items query to a temp file and used --input flag to pass it, avoiding shell quoting entirely for the larger query
- Followed the Phase 8 audio silent-fallback pattern: wrap entire function in try/catch, return [] on any error, log to console
- kanbanPollId declared in command handler closure so both setup block and dispose callback can access it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
Users must configure VS Code settings to enable kanban sync:
- `habboPixelAgents.githubProject.owner`: GitHub org or user login
- `habboPixelAgents.githubProject.ownerType`: "org" or "user"
- `habboPixelAgents.githubProject.projectNumber`: project number from the URL
- `habboPixelAgents.githubProject.pollIntervalSeconds`: refresh interval (0 = disabled)

The gh CLI must be installed and authenticated (`gh auth login`) for fetching to work. If not configured or authenticated, cards default silently to [].

## Next Phase Readiness
- KanbanCard[] data pipeline is complete and ready for Phase 12-03 (webview sticky note rendering)
- All 268 tests pass, typecheck clean
- No blockers

---
*Phase: 12-room-walls-kanban-notes*
*Completed: 2026-03-05*

# Phase 12 Plan 03: Kanban Sticky Notes Renderer Summary

Sticky note rendering for GitHub Projects kanban cards on isometric room walls using screen-space overlay after depth sort.

## What Was Built

- `src/isoKanbanRenderer.ts`: `statusToColor()` maps GitHub Projects status columns to colors (yellow/blue/green/grey); `leftWallNotePosition()` / `rightWallNotePosition()` compute screen-space positions for note slots on each wall edge; `drawStickyNote()` draws a 48x36 rounded-rect with truncated title text; `drawKanbanNotes()` distributes cards across left wall (column 0 tiles) then right wall (row 0 tiles) at 2 slots per tile row/column
- `src/RoomCanvas.tsx`: Added `kanbanCardsRef`, `kanbanCards` message handler, and `drawKanbanNotes` call at end of rAF loop after speech bubbles

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create isoKanbanRenderer.ts with sticky note drawing and wall position math | 8d82fc9 | src/isoKanbanRenderer.ts, tests/isoKanbanRenderer.test.ts |
| 2 | Integrate kanban messages and note rendering into RoomCanvas | 9dc1b36 | src/RoomCanvas.tsx |

## Decisions Made

- **statusToColor fallback to grey:** Unknown status column names (e.g. Backlog, Review) get `#e5e7eb` neutral grey — consistent with 'No Status' default. Avoids visible errors for custom column names.
- **Notes as topmost overlay:** `drawKanbanNotes` is called last in the rAF loop, after selection highlights, name tags, and speech bubbles. Notes are always visible on top of room geometry.
- **Slot positions at 30% / 60% wall height:** Two vertical positions per tile give visual variety and avoid notes overlapping at the baseline.
- **No-op on empty cards:** Early return when `cards.length === 0` — rooms without GitHub settings show no notes and incur zero draw cost.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written. Minor clarification: plan spec said "shift down ~40px for second note" but the implementation uses `WALL_HEIGHT * 0.3` and `WALL_HEIGHT * 0.6` (30% and 60%) which provides equivalent ~38-40px separation between slots.

## Verification

- `npx vitest run tests/isoKanbanRenderer.test.ts` — 11 tests pass
- `npx vitest run` — 279 tests across 19 test files, all passing
- `npm run typecheck` — no TypeScript errors
- Visual verification: requires manual webview check (Task 3 checkpoint)

## Self-Check: PASSED

All files and commits verified:
- FOUND: src/isoKanbanRenderer.ts
- FOUND: tests/isoKanbanRenderer.test.ts
- FOUND: commit 8d82fc9 (Task 1)
- FOUND: commit 9dc1b36 (Task 2)
