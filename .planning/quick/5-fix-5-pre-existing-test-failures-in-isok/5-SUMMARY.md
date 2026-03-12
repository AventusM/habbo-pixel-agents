---
phase: quick-5
plan: "01"
subsystem: testing
tags: [tests, kanban, quick-fix]
dependency_graph:
  requires: []
  provides: [green-test-suite]
  affects: [tests/isoKanbanRenderer.test.ts]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - tests/isoKanbanRenderer.test.ts
decisions:
  - "Align test expectations to implementation rather than changing source — tests were wrong, not the code"
  - "6x6 grid for capacity test ensures todoIdx and doneIdx are far enough apart to leave middle tiles for IP notes"
metrics:
  duration: 2min
  completed: "2026-03-12T20:09:49Z"
---

# Quick Task 5: Fix 2 Pre-existing Test Failures in isoKanbanRenderer Summary

**One-liner:** Corrected two stale test assertions in isoKanbanRenderer.test.ts — wrong `aggregateType` string and incorrect 2x2 grid geometry for the capacity test.

## Objective

Restore a fully green test suite by fixing test expectations that diverged from the actual source implementation.

## What Was Done

### Task 1: Fix isoKanbanRenderer test expectations to match implementation

Two tests failed because they were written against an older design that was later changed in the source.

**Fix 1 — Aggregate type mismatch (line 124-126):**
- Test searched for `h.aggregateType === 'backlog'` and expected `cardId === '__backlog__'`
- Source uses `aggregateType: 'todo'` (constant `TODO_ID = '__todo__'`)
- Changed test to `h.aggregateType === 'todo'` and `'__todo__'`

**Fix 2 — Capacity test with 2x2 grid returning 0 slots (line 155-177):**
- 2x2 grid gives `todoIdx = 0`, `doneIdx = 1`; `lo=0, hi=1` → filter `i > 0 && i < 1` matches nothing
- Updated to a 6x6 grid: `todoIdx = 4`, `doneIdx = 1`; middle indices 2 and 3 provide 2 tiles × 2 slots = 4 capacity
- Added 1 Todo and 1 Done card so both aggregates render and the capacity limit is exercised as intended

**Commit:** a5f10be

## Deviations from Plan

None — plan executed exactly as written.

## Verification

```
npx vitest run tests/isoKanbanRenderer.test.ts tests/messageBridge.test.ts

Test Files  2 passed (2)
      Tests  25 passed (25)
```

## Self-Check: PASSED

- [x] tests/isoKanbanRenderer.test.ts modified
- [x] Commit a5f10be exists
- [x] 25/25 tests green
