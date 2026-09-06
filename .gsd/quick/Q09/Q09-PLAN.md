---
id: Q09
title: "Definition-of-done checklist on kanban detail panel"
type: quick
status: implemented (see Q09-SUMMARY.md)
created: 2026-09-05
files_modified:
  - src/kanbanText.ts
  - src/agentTypes.ts
  - src/githubProjects.ts
  - src/isoKanbanRenderer.ts
  - tests/kanbanText.test.ts
  - tests/githubProjects.test.ts
---

# Q09: Definition-of-done checklist on kanban detail panel

## Problem

Issue bodies carry DoD / success-criteria checklists, but the detail panel only shows the
first ~600 chars of `bodyText`, so that context is cut off.

## Solution

1. Fetch `body` (markdown) alongside `bodyText` in `fetchKanbanCards`
2. `kanbanText.parseChecklistSection(body, pattern)` — extracts list items under a matching
   bold/heading section (`Definition of Done` / `DoD` / `Success criteria`), preserving
   `- [x]` task state; stops at the next section or non-list line
3. `KanbanCard.dod?: Array<{ text: string; done: boolean }>`
4. `drawExpandedNote` renders a DEFINITION OF DONE block: ✓/○ marks (same glyphs as
   sub-tasks), max 8 items, height-budgeted
5. Tests: parser cases + fetch mapping

## Verification

- `npm run typecheck` (no new errors)
- `npx vitest run` (all green)
- `node esbuild.config.mjs web` + server restart
- Live: #57 shows its 4 DoD items; #58/#59 show their success-criteria checklists
