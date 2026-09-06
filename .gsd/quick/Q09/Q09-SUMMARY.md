---
id: Q09
title: "Definition-of-done checklist on kanban detail panel"
type: quick
status: done
completed: 2026-09-05
verification_result: passed
files_modified:
  - src/kanbanText.ts
  - src/agentTypes.ts
  - src/githubProjects.ts
  - src/isoKanbanRenderer.ts
  - tests/kanbanText.test.ts
  - tests/githubProjects.test.ts
---

# Q09: Definition-of-done checklist on kanban detail panel — SUMMARY

**Detail panels now render a DEFINITION OF DONE block parsed from the issue body —
epic DoD items and slice success-criteria checklists with live ✓/○ state.**

## What Happened

`fetchKanbanCards` fetches `body` (markdown) alongside `bodyText`. New pure parser
`kanbanText.parseChecklistSection(body, pattern)` extracts list items under the first
matching bold/heading section (`Definition of Done` / `DoD` / `Success criteria`),
preserving GitHub task-list state (`- [x]`/`- [ ]`; plain bullets = not done) and stopping
at the next section or non-list line. Cards carry `dod?: KanbanCardChecklistItem[]`.
`drawExpandedNote` renders the block after the description: header, ✓ (green, struck-dim
when done) / ○ marks, max 8 items, panel cap raised 480→520.

## Verification

- `npm run typecheck` — 0 new errors (7 pre-existing)
- `npx vitest run` — 473/473 (6 new: parser bold/heading/state/stop cases, fetch mapping, omit-when-absent)
- Rebuilt `dist/web`, restarted server — HTTP 200
- Live: #57 shows its 4 DoD bullets; #58/#59 show their success-criteria checklists

## Notes / Follow-ups

- Checklist state is fetched fresh every 60s poll — as GSD mirrors tick items off, the room
  reflects progress without a rebuild
- Section header is rendered as the generic "DEFINITION OF DONE" even for slices whose
  source section is "Success criteria" — acceptable; could carry the matched header text if it matters later
- ADO cards have no body parsing (GitHub is the GSD lane)

## Key Decisions

- Parse at fetch time, store only the extracted items — keeps WS payloads bounded and the
  renderer dumb
- Reused sub-task glyph language (✓/○) for visual consistency
