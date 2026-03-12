---
phase: quick-fix
plan: 1
subsystem: room-layout
tags: [bugfix, furniture, rendering]
dependency_graph:
  requires: []
  provides: [visible-teleport-booths]
  affects: [roomLayoutEngine]
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - src/roomLayoutEngine.ts
decisions:
  - country_gate direction changed from 2 to 0 to match supported directions [0, 6]
metrics:
  duration: 1min
  completed: "2026-03-08T20:00:23Z"
---

# Quick Fix 1: Fix Invisible Teleport Booths Summary

Changed country_gate furniture direction from 2 to 0 so teleport booths render visibly in all room sections.

## What Changed

The `getSectionFurniture()` function in `roomLayoutEngine.ts` was placing country_gate furniture with `direction: 2`, but the country_gate asset only supports directions `[0, 6]`. When given an unsupported direction, the furniture renderer finds no sprites and silently renders nothing.

Changed `direction: 2` to `direction: 0` (line 178).

## Commits

| Task | Description | Commit | Files |
|------|------------|--------|-------|
| 1 | Change country_gate direction from 2 to 0 | e19fae2 | src/roomLayoutEngine.ts |

## Verification

- All 20 roomLayoutEngine tests pass
- country_gate now uses direction 0 (a supported direction)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
