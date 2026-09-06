---
id: Q07
title: "Clickable work items with description view in kanban notes"
type: quick
status: done
completed: 2026-09-05
verification_result: passed
files_modified:
  - src/agentTypes.ts
  - src/githubProjects.ts
  - src/kanbanText.ts
  - src/isoKanbanRenderer.ts
  - src/RoomCanvas.tsx
  - tests/kanbanText.test.ts
  - tests/githubProjects.test.ts
---

# Q07: Clickable work items with description view in kanban notes — SUMMARY

**Wall notes now expand to a richer panel: description text, label chips, and a clickable
"OPEN IN BROWSER ↗" footer that opens the GitHub issue.**

## What Happened

`fetchKanbanCards` fetches `bodyText` + `url` for issues (description truncated at 600 chars
at fetch time to bound WS payloads). `KanbanCard` gained `description?` / `url?`. New pure
module `src/kanbanText.ts` (`truncateText`, `condenseBlanks`, `wrapMonospace` — char-based
wrapping is exact for the monospace Press Start 2P face). `drawExpandedNote` renders up to
8 description lines, one label-chip row (max 6 chips), panel height cap raised 350→480.
Footer with a URL becomes a dark action strip; its screen-space rect is exposed via
`getExpandedNoteActionRect()`. `RoomCanvas.handleClick` opens `card.url` in a new tab on
footer clicks; panel-body clicks still close as before. Draft issues/PRs have no body/url,
so they keep the classic "click to close" footer. Works in the standalone web app and the
VS Code extension (shared fetch/message path).

## Verification

- `npm run typecheck` — 0 new errors (7 pre-existing in untouched legacy test files)
- `npx vitest run` — 465/465 across 28 files (14 new: wrap/condense/truncate, body+url mapping, 600-char truncation)
- `node esbuild.config.mjs web` + server restart — HTTP 200, client connected
- Live board: #57–#59 have descriptions and issue URLs (GSD mirror)

## Notes / Follow-ups

- Fixed a real bug during TDD: ellipsis replacement was a no-op when the final wrapped
  line was exactly full-width (truncateText(last, max) on a full line does nothing);
  fixed by appending '…' before truncating
- Azure DevOps cards have no description/url mapping (GitHub is the GSD lane) — ADO parity
  is a possible follow-up
- Demo data (`src/web/demoData.ts`) has no descriptions — fine for demo purposes

## Key Decisions

- Char-count wrapping instead of ctx.measureText — Press Start 2P is monospace, keeps the
  helper pure and unit-testable
- Truncation at fetch time (600 chars) keeps WebSocket payloads bounded; panel renders max 8 lines
- Footer hit rect stored as module state during draw (matches existing noteHitAreas pattern)
