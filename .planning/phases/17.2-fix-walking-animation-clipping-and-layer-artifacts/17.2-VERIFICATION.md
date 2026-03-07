---
phase: 17.2-fix-walking-animation-clipping-and-layer-artifacts
verified: 2026-03-07T21:32:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Walk avatar in direction 2 and observe chest/shirt alignment"
    expected: "No skin pixels visible between body and chest sprite during walk animation frames"
    why_human: "Visual pixel-level alignment cannot be verified programmatically"
  - test: "Walk avatar in flipped directions (4, 5, 6) and observe hands"
    expected: "No doubled-hand artifact; single hand visible per side with sleeve covering upper arm"
    why_human: "Doubled-hand is a visual composition artifact requiring screen inspection"
  - test: "Stand idle and sit; compare to pre-fix appearance"
    expected: "Identical rendering to before the fix -- no regression in idle/sit states"
    why_human: "Visual regression requires comparison against known-good baseline"
---

# Phase 17.2: Fix Walking Animation Clipping Verification Report

**Phase Goal:** Fix body-chest offset mismatch during walk animation (skin pixels bleeding through clothing) and doubled-hand artifact in flipped directions by computing walk-frame offset deltas and applying them to non-walk parts.
**Verified:** 2026-03-07T21:32:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Chest/shirt sprite tracks body bounce during walk animation with no skin pixel bleed-through | VERIFIED (code) | `getBodyWalkDelta` called at line 730 for non-walk parts including `ch`; delta applied to offsetX/offsetY |
| 2 | Head and hair parts track body bounce during walk animation | VERIFIED (code) | Same delta applied at line 730 for `hd`, `hr`, `hrb` (not in WALK_PARTS) |
| 3 | No doubled-hand artifact visible in flipped directions (4, 5, 6) | VERIFIED (code) | Delta uses `mapBodyDirection(direction).dir` (line 569) so flipped dirs use same mapped dir; test confirms dir 2 == dir 4 delta, dir 0 == dir 6 delta |
| 4 | Idle and sit rendering remain visually unchanged (zero delta applied) | VERIFIED (code + test) | Guard `stateForFrame === 'walk'` at lines 693 and 729; test at line 705 confirms idle produces `h_std` keys only |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/isoAvatarRenderer.ts` | Walk-frame offset delta correction for non-walk parts | VERIFIED | `getBodyWalkDelta` function (lines 558-587), applied in face parts (line 694) and body parts (line 730) |
| `tests/isoAvatarRenderer.test.ts` | Regression tests for walk delta, idle invariance, flip correctness | VERIFIED | 4 new tests: delta computation (line 664), missing frames fallback (line 696), idle invariance (line 705), flip direction equivalence (line 715) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/isoAvatarRenderer.ts` | `isoSpriteCache getNitroFrame` | `getBodyWalkDelta` reads std and wlk frame offsets | WIRED | Lines 576-577: `spriteCache.getNitroFrame(bdDef.asset, stdKey)` and `spriteCache.getNitroFrame(bdDef.asset, wlkKey)` |
| `createNitroAvatarRenderable` | `getBodyWalkDelta` | Delta applied to non-walk parts during walk state | WIRED | Called at lines 694 (face parts) and 730 (body non-walk parts), guarded by `stateForFrame === 'walk'` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUG-17.2-01 | 17.2-01 | ch offset tracks bd walk bounce | SATISFIED | `getBodyWalkDelta` delta applied to `ch` (non-walk part) during walk; test at line 664 |
| BUG-17.2-02 | 17.2-01 | No "two hands" in flipped directions | SATISFIED | Flipped directions use same mapped direction for delta; test at line 715 confirms |
| BUG-17.2-03 | 17.2-01 | Idle/sit rendering unchanged | SATISFIED | Guard on `stateForFrame === 'walk'`; test at line 705 confirms idle uses std keys only |

**Note:** BUG-17.2-01, BUG-17.2-02, BUG-17.2-03 are referenced in the ROADMAP and PLAN but not defined in REQUIREMENTS.md. They are ad-hoc bug identifiers defined in the RESEARCH document. This is an organizational gap but not a functional blocker.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/isoAvatarRenderer.ts` | 144 | "Placeholder avatar rendering (fallback)" comment | Info | Pre-existing fallback renderer, not related to this phase |

No blocker or warning-level anti-patterns found in modified code.

### Test Results

- Avatar renderer tests: 38/38 passed
- Full test suite: 325/325 passed
- TypeScript: no errors

### Human Verification Required

### 1. Walk Animation Chest Alignment

**Test:** Walk an avatar in direction 2 (south-east) and observe the chest/shirt area across all 4 walk frames.
**Expected:** No skin-colored pixels visible between the body and chest/shirt sprite. The shirt should track the body's up-down bounce perfectly.
**Why human:** Pixel-level visual alignment on canvas requires screen inspection.

### 2. Flipped Direction Hand Rendering

**Test:** Walk an avatar in directions 4, 5, and 6 (flipped directions) and observe the hand/sleeve areas.
**Expected:** Single hand visible per side with sleeve correctly overlapping the upper arm. No "doubled-hand" or ghost-hand artifact.
**Why human:** Doubled-hand is a visual layering artifact that requires visual inspection of the composed sprite output.

### 3. Idle and Sit Regression

**Test:** Compare idle and sitting avatar rendering against pre-fix appearance.
**Expected:** Identical rendering -- no visual change in idle or sit states.
**Why human:** Visual regression requires comparison against known-good baseline.

### Gaps Summary

No automated gaps found. All code-level truths are verified: the `getBodyWalkDelta` function exists, is substantive (computes real offset deltas from sprite cache data), is exported, is wired into both face-part and body-part render paths, and is guarded to only activate during walk state. Four regression tests cover the key behaviors. Full test suite passes (325 tests) with no TypeScript errors.

The remaining verification is visual: confirming that the computed deltas produce the correct on-screen result (no skin bleed-through, no doubled hands, no idle/sit regression).

---

_Verified: 2026-03-07T21:32:00Z_
_Verifier: Claude (gsd-verifier)_
