---
id: Q06
title: "Webview kanban filter toggle for GSD-labeled work items"
type: quick
status: done
completed: 2026-09-05
verification_result: passed
files_modified:
  - src/agentTypes.ts
  - src/githubProjects.ts
  - src/kanbanFilter.ts
  - src/RoomCanvas.tsx
  - tests/kanbanFilter.test.ts
  - tests/githubProjects.test.ts
---

# Q06: Webview kanban filter toggle for GSD-labeled work items — SUMMARY

**Labels flow from GitHub issues into kanban cards; `G` key cycles All → GSD only → Non-GSD in the room, with an HUD chip showing the active mode.**

## What Happened

Added `labels?: string[]` to `KanbanCard`, fetched via GitHub Projects GraphQL
(`labels(first: 10)` on Issue content; empty for draft issues/PRs). New pure helper
`src/kanbanFilter.ts` (`filterKanbanCards`, `nextKanbanFilterMode`, `isGsdCard`,
`KANBAN_FILTER_LABELS`, `GSD_LABEL='gsd'`). `RoomCanvas` keeps filter state + ref,
cycles on `G` (ignoring text inputs), filters wall notes / expanded note / aggregate
views, and renders a fixed-position HUD chip. Works in both the standalone web app and
the VS Code extension (same fetch + message path).

## Verification

- `npm run typecheck` — 0 new errors (7 pre-existing in untouched legacy test files; 8 before)
- `npx vitest run` — 27 files, 451 tests pass (8 new filter tests, 6 githubProjects incl. label mapping)
- `node esbuild.config.mjs web` — bundle rebuilt, labels present in dist/web/server.mjs
- Live board #57–#59 carry the `gsd` label (mirrored from GSD M001)

## Notes / Follow-ups

- The running `scripts/web-server.mjs` process imported the old server bundle at startup —
  restart it (`npm run web:serve`) to fetch labels; browser refresh picks up the new client
- Azure DevOps cards have no labels field — they count as non-GSD, which matches intent
- Click-to-open still uses note hit areas from the filtered set, so filtered-out cards
  can't be opened via stale expanded state

## Key Decisions

- Filter is client-side and transient (no persistence) — cheapest correct UX; revisit if a
  persisted preference is wanted
- `G` chosen (unbound key); input-guarded to avoid stealing typing
