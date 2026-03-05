---
phase: 12-room-walls-kanban-notes
plan: "02"
subsystem: api
tags: [github-projects, graphql, gh-cli, vscode-settings, polling, kanban]

# Dependency graph
requires:
  - phase: 12-01
    provides: room wall panels — provides the webview canvas where kanban sticky notes will eventually render
provides:
  - KanbanCard type exported from agentTypes.ts
  - fetchKanbanCards function in githubProjects.ts
  - kanbanCards ExtensionMessage variant
  - VS Code settings schema for GitHub Projects configuration
  - Polling interval with clearInterval cleanup on panel dispose
affects:
  - 12-03-PLAN.md (webview rendering of kanban sticky notes uses KanbanCard[])

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "gh CLI graphql via execFileSync with args array (no shell quoting issues)"
    - "Temp file for complex GraphQL queries to avoid shell quoting"
    - "Silent fallback: try/catch returns [] on any error — matches Phase 8 audio pattern"
    - "Polling via setInterval in extension host, clearInterval in panel.onDidDispose"

key-files:
  created:
    - src/githubProjects.ts
    - tests/githubProjects.test.ts
  modified:
    - src/agentTypes.ts
    - src/extension.ts
    - package.json

key-decisions:
  - "Use execFileSync args array (not execSync shell string) to avoid GraphQL quoting issues"
  - "Write complex GraphQL to temp file with --input flag for items query"
  - "Silent fallback pattern: catch all errors and return [] — same as audio phase"
  - "kanbanPollId declared in same closure scope as setup block and dispose callback"

patterns-established:
  - "gh CLI integration: execFileSync with args array, temp file for complex queries"
  - "Polling cleanup: clearInterval before agentManager.dispose in panel.onDidDispose"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 12 Plan 02: GitHub Projects Kanban Data Pipeline Summary

**GitHub Projects v2 kanban fetch via gh CLI graphql with VS Code settings, polling interval, and silent error fallback returning KanbanCard[] to webview**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T23:46:01Z
- **Completed:** 2026-03-05T23:51:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- KanbanCard interface and kanbanCards ExtensionMessage variant added to agentTypes.ts
- githubProjects.ts fetches project items via two-step gh api graphql (node ID lookup then items query) with temp file for the complex items GraphQL to avoid shell quoting issues
- Silent fallback returns [] on any error: gh not installed, auth failure, parse error
- Four VS Code settings exposed in package.json: owner, ownerType, projectNumber, pollIntervalSeconds
- extension.ts reads settings, does initial fetch + postMessage, sets up polling interval, and cleans up in panel.onDidDispose

## Task Commits

Each task was committed atomically:

1. **Task 1: KanbanCard type, githubProjects.ts fetch module, and message protocol extension** - `21af4e6` (feat)
2. **Task 2: VS Code settings and polling integration to extension.ts** - `2861dc2` (feat)

## Files Created/Modified
- `src/agentTypes.ts` - Added KanbanCard interface and kanbanCards ExtensionMessage variant
- `src/githubProjects.ts` - fetchKanbanCards: two-step gh graphql with temp file for items query, silent fallback
- `tests/githubProjects.test.ts` - 5 unit tests: error fallback, card parsing, no-status default, null-title default, user vs org query
- `src/extension.ts` - Added fetchKanbanCards import, settings read, initial fetch, polling, clearInterval dispose
- `package.json` - Added contributes.configuration with four githubProject settings

## Decisions Made
- Used execFileSync with args array (not execSync with shell string) to avoid GraphQL quoting issues with complex multi-line queries
- Wrote the items query to a temp file and used --input flag to pass it, avoiding shell quoting entirely for the larger query
- Followed the Phase 8 audio silent-fallback pattern: wrap entire function in try/catch, return [] on any error, log to console
- kanbanPollId declared in command handler closure so both setup block and dispose callback can access it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
Users must configure VS Code settings to enable kanban sync:
- `habboPixelAgents.githubProject.owner`: GitHub org or user login
- `habboPixelAgents.githubProject.ownerType`: "org" or "user"
- `habboPixelAgents.githubProject.projectNumber`: project number from the URL
- `habboPixelAgents.githubProject.pollIntervalSeconds`: refresh interval (0 = disabled)

The gh CLI must be installed and authenticated (`gh auth login`) for fetching to work. If not configured or authenticated, cards default silently to [].

## Next Phase Readiness
- KanbanCard[] data pipeline is complete and ready for Phase 12-03 (webview sticky note rendering)
- All 268 tests pass, typecheck clean
- No blockers

---
*Phase: 12-room-walls-kanban-notes*
*Completed: 2026-03-05*
