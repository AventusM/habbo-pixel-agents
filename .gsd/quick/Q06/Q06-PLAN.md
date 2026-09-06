---
id: Q06
title: "Webview kanban filter toggle for GSD-labeled work items"
type: quick
status: implemented (see Q06-SUMMARY.md)
created: 2026-09-05
files_modified:
  - src/agentTypes.ts
  - src/githubProjects.ts
  - src/kanbanFilter.ts
  - src/RoomCanvas.tsx
  - tests/kanbanFilter.test.ts
  - tests/githubProjects.test.ts
---

# Q06: Webview kanban filter toggle for GSD-labeled work items

## Problem

The room's kanban wall (localhost:3000) renders every board item uniformly. With GSD
milestones/slices now mirrored as GitHub issues labeled `gsd`, there is no way to view
GSD-driven work separately from other board content (demo drafts, historical PRs).

## Solution

1. Flow issue labels through `fetchKanbanCards` (GitHub Projects GraphQL) into `KanbanCard.labels`
2. New pure helper `src/kanbanFilter.ts` — modes `all | gsd | non-gsd`, cycling `nextKanbanFilterMode`
3. `RoomCanvas` — `G` key cycles the filter; wall notes, expanded-note and aggregate views all
   respect it; fixed-position HUD chip shows active mode
4. Unit tests for the filter helper + label mapping

## Verification

- `npm run typecheck`
- `npx vitest run tests/kanbanFilter.test.ts tests/githubProjects.test.ts`
- `node esbuild.config.mjs web` (server bundle picks up labels; server restart required)
- Live: board #57–#59 carry the `gsd` label; `G` toggle shows/hides them on the wall
