---
id: Q10
title: "Detail panel legibility (size/fonts) and ticket traversal"
type: quick
status: done
completed: 2026-09-05
verification_result: passed
files_modified:
  - src/isoKanbanRenderer.ts
  - src/RoomCanvas.tsx
  - tests/isoKanbanRenderer.test.ts
---

# Q10: Detail panel legibility (size/fonts) and ticket traversal — SUMMARY

**Detail panel enlarged twice on user feedback (240→440→560px wide, 6px→9px body text,
full DoD text wrapped per item) and full traversal added: prev/next/back nav bar in the
panel plus keyboard navigation.**

## What Happened

Round 1 (size): panelW 240→440, fonts 6/5/8→8/7/11, budgets rescaled.
Round 2 (details): panelW 440→560, fonts 9px body / 13px title; DoD items render their
FULL text via wrapMonospace (up to 5 lines/item, continuation lines indented under the
✓/○ mark) instead of a one-row ellipsis; description 12 lines; panel cap 640.

Traversal: `drawExpandedNote` takes `nav?: { canBack }` and draws a nav strip —
`◀ PREV` / `▲ BACK` (only when opened from an aggregate) / `NEXT ▶` — with hit rects
exposed via `getExpandedNoteNavRects()`. RoomCanvas tracks `noteOriginRef` (wall vs
aggregate) and handles nav clicks: prev/next move within the filtered card list
(wrap-around), back reopens the origin aggregate. Keyboard while a detail is open:
`←/→` or `n/p` = prev/next, `b` = back, `Esc` = close all. `G` filter toggle unchanged.

## Verification

- `npm run typecheck` — 0 new errors (7 pre-existing)
- `npx vitest run` — 475/475 (2 new: nav zones + back-zone geometry/no-overlap)
- `node esbuild.config.mjs web` + clean server restart (port-race resolved) — HTTP 200

## Notes / Follow-ups

- Nav strip draws only when `nav` is passed; renderer tests must pass `{ canBack }` explicitly
- One restart race observed (EADDRINUSE when old process lingered) — cleanup now kills
  listeners and waits before relaunch
- Possible follow-up: hover styling on nav zones; jump-to-card number entry

## Key Decisions

- Wrap instead of truncate for DoD text — user explicitly wants full requirements visible
- Keyboard traversal mirrors in-panel zones; both read the same filtered card list (Q06 filter respected)
