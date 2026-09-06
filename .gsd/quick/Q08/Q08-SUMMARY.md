---
id: Q08
title: "Aggregate list click-through to card detail panel"
type: quick
status: done
completed: 2026-09-05
verification_result: passed
files_modified:
  - src/isoKanbanRenderer.ts
  - src/RoomCanvas.tsx
  - tests/isoKanbanRenderer.test.ts
---

# Q08: Aggregate list click-through to card detail panel — SUMMARY

**Rows inside the Todo/Done aggregate list are now clickable: clicking a row opens that
card's full detail panel (description, labels, open-in-browser).**

## What Happened

User feedback on Q07: yellow Todo-column notes expand only to the aggregate list; Backlog
cards (where all GSD mirror issues live) have no individual wall notes, so the detail panel
was unreachable. Fix: `drawExpandedAggregateNote` now records a screen-space hit rect per
rendered row (module state, same pattern as noteHitAreas) and draws a '›' affordance on
each row; footer hint reads "click item for details · click to close". RoomCanvas checks
`getAggregateRowHitAreas()` before the close-all branch: a row hit swaps the aggregate for
that card's detail panel. Cross-panel state hygiene: each draw clears the other panel's
stale hit state.

## Verification

- `npm run typecheck` — 0 new errors (7 pre-existing, including 3 old `'backlog'` literal errors in this test file)
- `npx vitest run` — 467/467 (2 new: per-row hit rects + clear-on-redraw)
- Rebuilt `dist/web` and restarted the server — HTTP 200

## Notes / Follow-ups

- Detail panel for a row relies on the card being present in the filtered set (Q06) — consistent
- Hover highlighting for rows would be nice; skipped (no hover tracking infrastructure for wall notes)

## Key Decisions

- Click-through instead of rendering individual notes for every Backlog card — keeps the wall
  readable at 60+ board items
