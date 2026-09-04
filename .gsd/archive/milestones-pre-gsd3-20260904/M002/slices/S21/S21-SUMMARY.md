---
id: S21
parent: M002
milestone: M002
provides:
  - Larger room templates (15×15, 19×19, 25×25)
  - Multi-row desk placement for large sections
  - Adjusted agent-count size thresholds
requires: []
affects: []
key_files:
  - src/roomLayoutEngine.ts
  - src/idleWander.ts
  - tests/roomLayoutEngine.test.ts
key_decisions:
  - Roughly doubled template dimensions to give agents more room
  - Added second desk row for sections with 9+ usable tiles
  - Lowered size thresholds so rooms scale up sooner (small ≤8, medium ≤16)
patterns_established: []
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M002/slices/S21/tasks/T01-SUMMARY.md
duration: 30m
verification_result: passed
completed_at: 2026-03-14
---

# S21: Larger Room Sizes

**Enlarged all three room template sizes and added multi-row desk placement for bigger sections.**

## What Happened

Updated `TEMPLATE_SIZES` from 9/11/13 to 15/19/25, giving each section significantly more usable tiles. The `generateDeskTiles` function now places a second row of desks when a section has 9+ usable tiles. Agent-count thresholds for size selection were lowered (small ≤8, medium ≤16 instead of ≤12/≤24) so rooms scale up sooner. Wander radius increased from 5 to 8 tiles to match the larger space. All roomLayoutEngine tests updated to match new dimensions.

## Verification

All roomLayoutEngine tests pass with updated size expectations and boundary values.

## Deviations

None.

## Known Limitations

- Desk placement is still grid-aligned rows; no L-shaped or clustered arrangements.

## Follow-ups

None.

## Files Created/Modified

- `src/roomLayoutEngine.ts` — updated TEMPLATE_SIZES, generateDeskTiles (two-row logic), getTemplateSize thresholds
- `src/idleWander.ts` — WANDER_RADIUS 5 → 8
- `tests/roomLayoutEngine.test.ts` — updated all dimension and boundary test expectations

## Forward Intelligence

### What the next slice should know
- Room dimensions are now much larger; any hardcoded position assumptions from old sizes will be wrong.

### What's fragile
- The two-row desk placement uses a fixed offset of 3 between rows — may need tuning if section sizes change again.

### Authoritative diagnostics
- `tests/roomLayoutEngine.test.ts` — covers all three template sizes and boundary thresholds.

### What assumptions changed
- Template sizes were roughly doubled, not just incremented — downstream layout logic should not assume old dimensions.
