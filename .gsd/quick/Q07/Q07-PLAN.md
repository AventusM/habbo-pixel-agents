---
id: Q07
title: "Clickable work items with description view in kanban notes"
type: quick
status: implemented (see Q07-SUMMARY.md)
created: 2026-09-05
files_modified:
  - src/agentTypes.ts
  - src/githubProjects.ts
  - src/kanbanText.ts
  - src/isoKanbanRenderer.ts
  - src/RoomCanvas.tsx
  - tests/githubProjects.test.ts
  - tests/kanbanFilter.test.ts
---

# Q07: Clickable work items with description view in kanban notes

## Problem

Wall notes expand to badges/title/subtasks/PRs but show no description, and there is no
way to open the underlying GitHub issue from the room.

## Solution

1. Fetch issue `body` + `url` in `fetchKanbanCards`; add `description?: string`, `url?: string` to `KanbanCard`
2. `kanbanFilter.ts` gains `stripMarkdown` + `wrapText` pure helpers (used by renderer + tests)
3. `drawExpandedNote` renders a truncated description block and, when `card.url` exists, a
   clickable footer zone ("OPEN IN BROWSER ↗") whose rect is exported via `getExpandedNoteActionRect()`
4. `RoomCanvas` click handler: if expanded panel's action rect is hit → `window.open(card.url)`
   instead of closing; note body click still closes
5. Tests: body/url mapping, stripMarkdown/wrapText, action-rect hit logic

## Verification

- `npm run typecheck` (no new errors)
- `npx vitest run tests/githubProjects.test.ts tests/kanbanFilter.test.ts tests/isoKanbanRenderer.test.ts`
- `node esbuild.config.mjs web` + server restart
- Live: click note #58 → panel shows design-note description; footer click opens GitHub
