---
phase: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement
verified: 2026-03-07T18:56:00Z
status: human_needed
score: 8/9 must-haves verified
human_verification:
  - test: "Build the extension and open the webview. Place an avatar facing direction 2 (toward camera). Verify no stray pixel appears near the avatar at any direction (0-7). Test blink animation for clean transitions."
    expected: "No stray pixel visible at any avatar direction. Blink animation clean."
    why_human: "Stray pixel is a visual compositing artifact that cannot be verified programmatically -- requires rendering in a real browser canvas."
  - test: "Right-click on an empty walkable tile. Verify the nearest idle avatar walks to that tile."
    expected: "Avatar pathfinds and walks to the right-clicked tile."
    why_human: "Canvas interaction model requires live browser testing with mouse events."
  - test: "Right-click on a chair tile. Verify the nearest avatar walks to and sits in the chair."
    expected: "Avatar walks to chair and sits with correct direction."
    why_human: "Chair-sit behavior involves animation and state transitions that need visual confirmation."
  - test: "Left-click on an empty tile. Verify NO avatar moves."
    expected: "Nothing happens (previous avatar deselects if any was selected, but no movement)."
    why_human: "Verifying absence of behavior requires interactive testing."
  - test: "Left-click on an avatar. Verify the avatar builder panel opens."
    expected: "Builder panel opens for the clicked avatar."
    why_human: "UI panel opening requires live rendering context."
  - test: "Right-click on canvas while in editor mode (paint/color/furniture). Verify no movement occurs."
    expected: "Right-click is ignored in editor modes. Editor tools continue to work with left-click."
    why_human: "Editor mode interaction requires live UI testing."
---

# Phase 17.1: Stray Pixel Diagnostic Fix and Right-Click Movement Verification Report

**Phase Goal:** Diagnose and fix stray pixel artifact near avatar, add right-click movement with left-click for selection only
**Verified:** 2026-03-07T18:56:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Stray pixel near avatar is identified and eliminated | ? UNCERTAIN | Root cause identified as `imageSmoothingEnabled=true` on tint canvas. Fix applied in `isoAvatarRenderer.ts:401` and `avatarBuilderPreview.ts:52`. Visual confirmation needed. |
| 2 | Face rendering can be toggled off for diagnostic purposes | VERIFIED | `DEBUG_AVATAR_PARTS` flag at `isoAvatarRenderer.ts:12` (set to `false`), used at lines 529 and 724 for colored debug borders |
| 3 | Spritesheet PNG verified clean or cleaned of stray pixels | VERIFIED | Scanner script reports 0 stray pixels across all 21 figure spritesheets per summary; script is 247-line substantive implementation |
| 4 | Left-click on avatar opens the builder panel (unchanged) | VERIFIED | `handleClick` lines 545-555 in RoomCanvas.tsx: `setIsBuilderOpen(true)` and `setBuilderAvatarId(clickedAvatar.id)` |
| 5 | Left-click on empty tile does NOT move any avatar | VERIFIED | `handleClick` (lines 469-563) contains zero calls to `moveAvatarTo` or `sitAvatar`. Lines 558-562 only deselect. |
| 6 | Right-click on any walkable tile moves the nearest idle avatar to that tile | VERIFIED | `handleContextMenu` lines 646-678: finds nearest idle/walk avatar, calls `moveAvatarTo` |
| 7 | Right-click on a chair tile moves nearest avatar to sit in the chair | VERIFIED | `handleContextMenu` lines 588-643: chair detection, pathfind, sit-on-arrival logic |
| 8 | Browser context menu is suppressed on canvas right-click | VERIFIED | `event.preventDefault()` at line 566 of `handleContextMenu` |
| 9 | Editor modes still work with left-click only | VERIFIED | Editor modes handled in `handleClick` lines 510-537; `handleContextMenu` returns early at line 571 for non-view modes |

**Score:** 8/9 truths verified (1 needs human visual confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/isoAvatarRenderer.ts` | Diagnostic logging + imageSmoothingEnabled fix | VERIFIED | `DEBUG_AVATAR_PARTS` flag at line 12; `imageSmoothingEnabled = false` at line 401 with explanatory comment |
| `scripts/check-spritesheet-stray-pixels.mjs` | Node script to scan spritesheets for stray pixels | VERIFIED | 247-line script with PNG parsing, frame-bounds checking, coverage bitmap, --clean flag, and summary reporting |
| `src/avatarBuilderPreview.ts` | Same imageSmoothingEnabled fix for preview | VERIFIED | `imageSmoothingEnabled = false` at line 52, plus line 134 for main context |
| `src/RoomCanvas.tsx` | handleContextMenu for right-click movement, handleClick simplified | VERIFIED | handleContextMenu at line 565 with full movement logic; handleClick at line 469 with NO movement logic |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/RoomCanvas.tsx` | `handleContextMenu` | `onContextMenu={handleContextMenu}` on canvas | WIRED | Line 852: `onContextMenu={handleContextMenu}` on the canvas element |
| `src/RoomCanvas.tsx` | `handleClick` | Movement logic removed, selection-only | WIRED | Lines 469-563: only sticky notes, editor modes, avatar click (builder), and deselect remain |
| `isoAvatarRenderer.ts` | tint canvas | `imageSmoothingEnabled = false` | WIRED | Line 401: set during tint canvas initialization in `getTintCtx()` |
| `avatarBuilderPreview.ts` | tint canvas | `imageSmoothingEnabled = false` | WIRED | Line 52: set during tint canvas initialization in `getTintCanvas()` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| Ongoing | Plan 01, Plan 02 | Bugfixes and user-requested improvements | SATISFIED | Both stray pixel fix and right-click movement are targeted fixes from user feedback |

No orphaned requirements found. Both plans reference "Ongoing" which is a general-purpose requirement ID for post-v1 bugfixes and polish.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| -- | -- | None found | -- | -- |

No TODO/FIXME/HACK/PLACEHOLDER comments in any modified files. No empty implementations or stub handlers. `DEBUG_AVATAR_PARTS = false` is correctly set (not left enabled).

### Human Verification Required

### 1. Stray Pixel Visual Confirmation

**Test:** Build the extension and open the webview. Place an avatar facing direction 2 (toward camera). Check all 8 directions (0-7) and blink animation.
**Expected:** No stray pixel visible near the avatar at any direction. Blink transitions clean.
**Why human:** The stray pixel is a canvas compositing artifact that only manifests in a live browser rendering context. Static code analysis confirms the fix is applied but cannot confirm the visual result.

### 2. Right-Click Movement

**Test:** Right-click on an empty walkable tile while in view mode.
**Expected:** Nearest idle avatar pathfinds and walks to the clicked tile.
**Why human:** Canvas mouse event handling requires live browser interaction.

### 3. Right-Click Chair Sit

**Test:** Right-click on a chair tile.
**Expected:** Nearest avatar walks to the chair and sits with correct facing direction.
**Why human:** Chair-sit involves animation state machine transitions that need visual confirmation.

### 4. Left-Click No Movement

**Test:** Left-click on an empty tile (not on an avatar).
**Expected:** No avatar moves. If an avatar was selected, it deselects.
**Why human:** Verifying absence of behavior requires interactive testing.

### 5. Left-Click Avatar Builder

**Test:** Left-click directly on an avatar sprite.
**Expected:** Avatar builder panel opens for that avatar.
**Why human:** UI panel rendering requires live context.

### 6. Editor Mode Isolation

**Test:** Switch to paint/color/furniture editor mode, then right-click on a tile.
**Expected:** No movement occurs. Editor tools continue to work with left-click.
**Why human:** Editor mode interaction requires live UI testing.

### Gaps Summary

No gaps found in automated verification. All artifacts exist, are substantive (not stubs), and are properly wired. The scanner script is a complete 247-line implementation. The imageSmoothingEnabled fix is applied in both rendering paths with explanatory comments. The right-click handler is fully implemented with chair-sit, walkable-tile movement, editor-mode guard, and context menu suppression. The left-click handler has been cleanly simplified to selection-only (zero movement calls).

The only outstanding item is human visual confirmation that the stray pixel fix actually eliminates the artifact in the rendered output, and that the right-click interaction model works as expected in the live UI.

All 321 tests pass with no regressions.

Commits verified: `4cb0277` (stray pixel fix) and `450cd1d` (right-click movement) both exist in the git history.

---

_Verified: 2026-03-07T18:56:00Z_
_Verifier: Claude (gsd-verifier)_
