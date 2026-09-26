---
id: S03
parent: M006
milestone: M006
provides:
  - Versioned localStorage persistence for per-role outfit drafts (save/load/validate, never throws)
  - OutfitStore hydration (saved drafts win per role) + synchronous autosave on mutations
  - AvatarManager restyleAvatar/applyRoleOutfit APIs; spawn paths resolve outfits from store drafts
  - useOutfitLiveSync hook pushing draft edits onto walking agents without respawn
requires: []
affects: []
key_files:
  - src/state/outfitPersistence.ts
  - src/state/outfitStore.ts
  - src/avatarManager.ts
  - src/hooks/useOutfitLiveSync.ts
  - src/RoomCanvas.tsx
key_decisions:
  - Spawn resolves outfits from outfitStore drafts (drafts own the full outfit); S01 variant-skin cycling retired
  - OutfitStore takes an injectable storage surface (ambient localStorage by default, null outside a browser)
  - Live sync pushes only changed roles by draft-reference diff; hook mounted once in RoomCanvas (D021)
patterns_established:
  - Injectable-storage store construction for browser-API-dependent state (unit-testable in node)
  - Pure diff + sync functions beside a thin subscribing hook (mirrors useCharacterEditor/buildCharacterEditorView split)
observability_surfaces:
  - console.debug on persistence load/save/restyle events ([outfitPersistence]/[avatarManager] restyle)
drill_down_paths: []
duration: 1 continuation pass
verification_result: passed
completed_at: 2026-09-26
---

# S03: Outfit persistence + restyle live agents

Customize a role outfit, reload the page, and the outfit persists; editing a draft restyles a live walking agent of that role without respawning it.

## What Happened

Implemented all 5 planned tasks in one continuation pass on branch
`gsd/m006-s03-outfit-persistence-restyle-live` (commits 9988138, 46c70ee,
711e446, 73671ad + abide evidence 4a809de):

- T01: `src/state/outfitPersistence.ts` + 14 tests.
- T02: hydration + autosave in `OutfitStore` (+4 tests).
- T03: restyle API + spawn draft resolution (+6 tests; 3 pre-existing spawn tests updated to the draft-owns-outfit contract).
- T04: `useOutfitLiveSync` (+5 tests) mounted in RoomCanvas.
- T05: full sweep green (vitest 61 files/791 tests, tsc 0, lint 0 errors, esbuild 0).

Q3/Q4 quality gates evaluated `omitted` before execution. Canonical task/slice
rows could not be closed mechanically (no running attempt in this lane);
commits are the durable record per the D018 precedent.

## Verification

vitest 791 passed; tsc exit 0; eslint 0 errors; esbuild exit 0. Abide audit:
4 logic files clear; RoomCanvas keeps its 2 pre-existing whole-file flags
(baseline-identical). Visual reload-persistence + live-restyle proof recorded
NEEDS-HUMAN (headless lane cannot launch the extension host).

## Files Created/Modified

- `src/state/outfitPersistence.ts` (new), `tests/outfitPersistence.test.ts` (new)
- `src/state/outfitStore.ts`, `tests/outfitStore.test.ts`
- `src/avatarManager.ts`, `tests/avatarRestyle.test.ts` (new), `tests/avatarManager.test.ts`
- `src/hooks/useOutfitLiveSync.ts` (new), `tests/outfitLiveSync.test.ts` (new), `src/RoomCanvas.tsx`

## Forward Intelligence

### What the next slice should know

- S03 is the milestone's last slice; M006 validation/completion is the next step after the slice PR merges.
- Task/slice DB rows remain pending (D018); the next auto pass should reconcile them from these commits.

### What's fragile

- Spawn variant-skin cycling is retired: all same-team agents share the draft skin until customized per agent (out of scope).
- RoomCanvas whole-file abide flags pre-date this slice; the M008 extraction remains the fix.
