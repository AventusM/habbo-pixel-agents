---
phase: 17-bugfixes-and-wishlist
verified: 2026-03-07T13:55:00Z
status: passed
score: 13/13 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 17: Bugfixes & Wishlist -- Verification Report

**Phase Goal:** Ongoing bugfixes and wishlist items -- fix stray pixel rendering bugs, improve avatar builder UX
**Verified:** 2026-03-07T13:55:00Z
**Status:** PASSED
**Re-verification:** Yes -- expanded scope (plans 02 and 03 added since previous verification of plan 01 only)

## Goal Achievement

### Observable Truths

**Plan 01: In Progress Notes Single-Wall Constraint**

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | In Progress sticky notes render only on the left wall, never overflowing to the right wall | VERIFIED | `rightSmallTiles` has zero grep matches in `src/isoKanbanRenderer.ts`. Only `for (const { tx, ty } of leftSmallTiles)` loop exists (line 410). Test `never places In Progress notes on the right wall` at line 179 passes. |
| 2 | Right wall continues to show only the large Done aggregate note | VERIFIED | `rightSmallTiles` variable and loop fully removed. `smallCapacity = leftSmallTiles.length * 2` at line 406 is the sole capacity formula. |
| 3 | Left wall shows both large Backlog aggregate and small In Progress notes (non-overlapping tiles) | VERIFIED | `hasLeftLarge` mid-tile exclusion logic retained. Backlog aggregate and small In Progress notes cannot share the same tile. |
| 4 | All existing kanban renderer tests pass with updated expectations | VERIFIED | 16 kanban tests pass. Full suite: 321 tests pass across 20 test files. |

**Plan 02: Stray Pixel Fix & Face Rendering**

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 5 | No stray pixel/particle appears when avatars face diagonal directions (1, 3, 5) | VERIFIED | `tCtx.clearRect(0, 0, _tintCanvas!.width, _tintCanvas!.height)` at line 423 of `src/isoAvatarRenderer.ts`. Old buggy pattern `clearRect(0, 0, frame.w, frame.h)` has zero matches. |
| 6 | Face features (eyes, mouth) are visually present and correctly positioned at all visible directions | VERIFIED (visual needs human) | Face rendering code (ey/fc parts) present in renderer. Face frame key format tested. Direction filtering skips only back-facing dirs 0 and 7. |
| 7 | Face sprites align with the head sprite at every rendered direction -- no offset drift | VERIFIED (visual needs human) | Offset calculations use same registration point pattern as body parts. |
| 8 | Blink animation (eyb action) does not produce stray pixels at any direction | VERIFIED | clearRect fix clears full canvas for all parts including eyb frames. Blink animation tests pass (frames 1->2->3->0 cycle). |
| 9 | Preview renderer in avatarBuilderPreview.ts stays consistent with main renderer changes | VERIFIED | `tCtx.clearRect(0, 0, _tintCanvas!.width, _tintCanvas!.height)` at line 73 of `src/avatarBuilderPreview.ts`. Same fix applied in both renderers. |

**Plan 03: Avatar Builder Inline Panel**

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 10 | Avatar editor renders as an inline panel below the LayoutEditorPanel, not as a full-screen modal overlay | VERIFIED | `position: 'fixed'` has zero matches in `AvatarBuilderModal.tsx`. Component uses `position: 'absolute', left: '10px', bottom: '10px'` (lines 212-213). LayoutEditorPanel at `top: '10px'` (line 55). No overlap. |
| 11 | Clicking an avatar opens the inline editor panel without blocking click-to-move on the canvas | VERIFIED | `isBuilderOpenRef` has zero matches in `RoomCanvas.tsx` -- the click-blocking guard `if (isBuilderOpenRef.current) return` is fully removed. |
| 12 | The inline panel includes all existing functionality: preview, clothing selection, color palettes, gender toggle, wardrobe, save/cancel | VERIFIED | `AvatarBuilderPanel` (519 lines) includes: gender toggle, SKIN/HAIR/CLOTHING palettes (21 references), wardrobe slots, save button (`onSave` at line 481), cancel button (`onClose` at line 497), canvas preview ref. No stopPropagation calls (zero matches). |
| 13 | Saving or cancelling the editor closes the inline panel | VERIFIED | `handleBuilderSave` at line 785 and `handleBuilderClose` at line 799 of `RoomCanvas.tsx` wired to `onSave`/`onClose` props at lines 843-844. Both handlers set `isBuilderOpen` to false. |

**Score:** 13/13 truths verified

### Required Artifacts

**Plan 01**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/isoKanbanRenderer.ts` | Single-wall constraint for In Progress notes | VERIFIED | `rightSmallTiles` absent. `smallCapacity = leftSmallTiles.length * 2` at line 406. Single loop at line 410. |
| `tests/isoKanbanRenderer.test.ts` | Updated capacity test and new single-wall assertion | VERIFIED | Capacity test expects 4. New test at line 179 asserts zero right-wall small notes. |

**Plan 02**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/isoAvatarRenderer.ts` | Fixed tint canvas clearRect to use full canvas dimensions | VERIFIED | Line 423: `tCtx.clearRect(0, 0, _tintCanvas!.width, _tintCanvas!.height)`. Old pattern `frame.w, frame.h` has zero matches. `DEBUG_AVATAR_PARTS = false` at line 12. |
| `src/avatarBuilderPreview.ts` | Matching tint canvas clearRect fix for preview renderer | VERIFIED | Line 73: `tCtx.clearRect(0, 0, _tintCanvas!.width, _tintCanvas!.height)`. Same fix. |
| `tests/isoAvatarRenderer.test.ts` | Tests for mirrored directions and face direction filtering | VERIFIED | 34 tests total. New tests at lines 588-636: direction 4->2 mapping, all 8 dirs produce valid mapped dirs, head setId cycling, walk/non-walk action selection. |

**Plan 03**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/AvatarBuilderModal.tsx` | Refactored from modal overlay to inline panel (AvatarBuilderPanel) | VERIFIED | Exported as `AvatarBuilderPanel` at line 60. `position: 'absolute'` with `bottom: '10px'` positioning. Width 220px, maxHeight 500px. Backward-compatible re-export at line 519. No `position: 'fixed'` anywhere. |
| `src/RoomCanvas.tsx` | Inline panel rendered below LayoutEditorPanel; click handler allows interaction | VERIFIED | Imports `AvatarBuilderPanel` at line 37. Renders `<AvatarBuilderPanel` at line 839. `isBuilderOpenRef` fully removed (zero matches). |
| `src/avatarBuilderPreview.ts` | Smaller preview dimensions for inline panel | VERIFIED | `PREVIEW_WIDTH = 80` at line 11. `PREVIEW_HEIGHT = 120` at line 12. Reduced from 120x180. |

### Key Link Verification

**Plan 01**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/isoKanbanRenderer.ts` | `drawKanbanNotes` | `leftSmallTiles` loop only | WIRED | `for.*leftSmallTiles` matched at line 410. `for.*rightSmallTiles` has zero matches. |

**Plan 02**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/isoAvatarRenderer.ts` | `drawTintedBodyPart` | clearRect uses full tint canvas dimensions | WIRED | Pattern `tCtx.clearRect(0, 0, _tintCanvas!.width, _tintCanvas!.height)` matched at line 423. |
| `src/avatarBuilderPreview.ts` | `drawTintedPart` | Same clearRect fix | WIRED | Pattern matched at line 73. |

**Plan 03**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/RoomCanvas.tsx` | `src/AvatarBuilderModal.tsx` | `AvatarBuilderPanel` rendered as sibling | WIRED | `<AvatarBuilderPanel` at line 839. Import at line 37. |
| `src/RoomCanvas.tsx` | `handleClick` | `isBuilderOpenRef` guard removed | WIRED | `isBuilderOpenRef` has zero matches -- guard fully removed, canvas clicks pass through. |
| `src/avatarBuilderPreview.ts` | `src/AvatarBuilderModal.tsx` | Reduced PREVIEW_WIDTH/HEIGHT imported by panel | WIRED | `PREVIEW_WIDTH = 80` at line 11. Imported at line 16 of AvatarBuilderModal.tsx. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| Ongoing | 17-01-PLAN.md | Bugfix: constrain In Progress notes to left wall | SATISFIED | rightSmallTiles removed, single-wall capacity, tests pass |
| Ongoing | 17-02-PLAN.md | Bugfix: stray pixel elimination via full tint canvas clear | SATISFIED | clearRect fix in both renderers, direction mapping tests added |
| Ongoing | 17-03-PLAN.md | Feature: avatar editor as non-blocking inline panel | SATISFIED | Modal converted to panel, click blocking removed, all functionality preserved |

**Orphaned requirements check:** No entries in REQUIREMENTS.md reference "Phase 17". The `Ongoing` requirement declaration across all three plans is the intended pattern for this bugfix/wishlist phase. No orphaned IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/isoKanbanRenderer.ts` | 470 | `void hasRightLarge;` | Info | Intentional lint suppression -- variable used by Done note conditional. Not a stub. |

No TODO/FIXME/placeholder comments found in any modified file. No empty implementations. No stub patterns. No `console.log` stubs.

### Commit Verification

All documented commit hashes verified in git log:

| Plan | Commit | Description | Verified |
|------|--------|-------------|----------|
| 01 | `f30346e` | fix(17-01): constrain In Progress notes to left wall only | Yes |
| 02 | `c7cf1d0` | fix(17-02): clear full tint canvas to eliminate stray pixel leak | Yes |
| 02 | `7f40c80` | test(17-02): add direction mapping and face rendering tests | Yes |
| 03 | `b089b68` | feat(17-03): convert AvatarBuilderModal to inline AvatarBuilderPanel | Yes |
| 03 | `59c8bca` | feat(17-03): integrate inline panel into RoomCanvas and remove click blocking | Yes |

### Test Suite

321 tests passing across 20 test files. Zero failures, zero regressions.

### Human Verification Required

### 1. Face Feature Visual Positioning

**Test:** Build the extension, place avatars facing directions 1, 2, 3, 4, 5. Observe face features (eyes, mouth) on the head sprite.
**Expected:** Eyes and mouth are visible, correctly positioned on the head, and do not appear as floating pixels. No stray particle at any direction.
**Why human:** Sprite offset alignment at sub-pixel level and visual quality of small face sprites (4-5px at diagonal directions) cannot be verified programmatically.

### 2. Avatar Builder Inline Panel Usability

**Test:** Click an avatar to open the builder panel. While panel is open, click an empty floor tile to move an avatar. Click a chair to sit. Change clothing, colors, and gender in the panel. Save and cancel.
**Expected:** Panel appears at bottom-left. Canvas interactions work simultaneously. All editor controls function correctly in the compact 220px layout. Panel closes on save/cancel.
**Why human:** Simultaneous panel + canvas interaction UX, layout fit at 220px width, and visual polish cannot be verified programmatically.

### Gaps Summary

No gaps found. All 13 must-have truths across three plans are verified against the actual codebase:

1. **Plan 01 (Kanban single-wall constraint):** rightSmallTiles completely removed, capacity formula updated, tests updated and passing. Previously verified -- no regressions.

2. **Plan 02 (Stray pixel fix):** clearRect uses full tint canvas dimensions in both renderers. Old buggy pattern has zero matches. DEBUG_AVATAR_PARTS set to false. 4 new direction mapping tests added. 34 avatar renderer tests pass.

3. **Plan 03 (Avatar builder inline panel):** Component refactored from fixed overlay to absolute-positioned inline panel. Click-blocking guard fully removed. All editor functionality preserved (gender, palettes, wardrobe, save/cancel, preview). Backward-compatible re-export maintained. No stopPropagation calls.

All 5 implementation commits verified in git log. 321 tests pass with zero regressions.

---

_Verified: 2026-03-07T13:55:00Z_
_Verifier: Claude (gsd-verifier)_
