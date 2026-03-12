---
phase: 17.3-fix-move-logic-to-respect-selected-avatar
verified: 2026-03-08T21:30:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 17.3: Fix Move Logic to Respect Selected Avatar Verification Report

**Phase Goal:** Wire selectAvatar() into the left-click avatar handler so right-click movement targets the user-selected avatar instead of always falling back to the nearest idle avatar.
**Verified:** 2026-03-08T21:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Left-clicking an avatar selects it (yellow highlight appears) | VERIFIED | `selectAvatar(clickedAvatar.id)` called at line 1129 + `isSelected` synced at lines 1130-1132 in RoomCanvas.tsx |
| 2 | Right-clicking a tile moves the selected avatar, not the nearest one | VERIFIED | `selectionMgr.selectedAvatarId` checked at lines 1204 and 1260 in right-click handler, preferring selected avatar over nearest |
| 3 | Left-clicking empty space deselects the current avatar | VERIFIED | `deselectAvatar()` called at line 1162 + all `isSelected` cleared at lines 1163-1165 |
| 4 | Selected avatar despawn clears the selection (already works) | VERIFIED | `deselectAvatar()` called at line 374 in despawn handler |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/RoomCanvas.tsx` | selectAvatar() call on left-click avatar handler | VERIFIED | 6 lines added in commit 33f47e0, contains selectAvatar call and isSelected sync |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| RoomCanvas.tsx (left-click handler) | avatarSelection.ts (selectAvatar) | `selectionManagerRef.current.selectAvatar(clickedAvatar.id)` | WIRED | Line 1129 |
| RoomCanvas.tsx (right-click handler) | avatarSelection.ts (selectedAvatarId) | `selectionMgr.selectedAvatarId` lookup | WIRED | Lines 1204, 1260 -- both chair-sit and walk-to paths check selected avatar |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUG-17.3-01 | 17.3-01-PLAN | Move logic should respect selected avatar | SATISFIED | selectAvatar wired into left-click; right-click checks selectedAvatarId |

Note: BUG-17.3-01 is not defined in REQUIREMENTS.md (it is an ad-hoc bug-fix ID used only in this phase). This is acceptable for an inserted bug-fix phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | -- | -- | -- | -- |

No TODOs, FIXMEs, placeholders, or stub implementations found in the modified code paths.

### Human Verification Required

### 1. Visual Avatar Selection Highlight

**Test:** Left-click an avatar in the room view
**Expected:** Yellow highlight appears around the clicked avatar; previously highlighted avatar loses highlight
**Why human:** Visual rendering behavior cannot be verified programmatically

### 2. Right-Click Movement Targeting

**Test:** Left-click avatar A, then right-click an empty tile
**Expected:** Avatar A walks to the tile (not the nearest avatar to the tile)
**Why human:** Requires interactive multi-step user flow in the running extension

### Gaps Summary

No gaps found. All four observable truths are verified in the codebase. The fix is minimal (6 lines added) and surgically placed before existing popup/builder logic, ensuring the selection state is set for all subsequent click-handling code paths. The right-click handler already had the selectedAvatarId lookup -- it just was never populated until this fix.

---

_Verified: 2026-03-08T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
