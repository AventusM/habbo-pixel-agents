# S21: Larger Room Sizes

**Goal:** Enlarge room templates for more agent workspace with multi-row desk placement.
**Demo:** Rooms render at 15×15 / 19×19 / 25×25 with desks arranged in multiple rows for larger sections.

## Must-Haves

- TEMPLATE_SIZES updated: small 15×15, medium 19×19, large 25×25
- Desk placement uses two rows when section has 9+ usable tiles
- Agent-count thresholds lowered: small ≤8, medium ≤16
- Wander radius increased to 8
- All tests passing with updated expectations

## Verification

- `npm test -- --grep "roomLayoutEngine"` — all template size and boundary tests pass

## Tasks

- [x] **T01: Enlarge room templates and update desk placement** `est:30m`
  - Why: Rooms feel cramped; agents need more space
  - Files: `src/roomLayoutEngine.ts`, `src/idleWander.ts`, `tests/roomLayoutEngine.test.ts`
  - Do: Update TEMPLATE_SIZES constants, add second desk row for usable ≥9, lower getTemplateSize thresholds, increase WANDER_RADIUS
  - Verify: `npm test -- --grep "roomLayoutEngine"`
  - Done when: All roomLayoutEngine tests pass with new dimensions

## Files Likely Touched

- `src/roomLayoutEngine.ts`
- `src/idleWander.ts`
- `tests/roomLayoutEngine.test.ts`
