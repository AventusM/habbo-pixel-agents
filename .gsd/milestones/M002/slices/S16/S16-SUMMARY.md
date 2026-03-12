---
id: S16
parent: M002
milestone: M002
provides:
  - fetchAzureDevOpsCards async function (org, project, pat) returning KanbanCard[]
  - mapAzureDevOpsState function mapping Azure DevOps states to kanban statuses
  - Silent-fallback Azure DevOps data source adapter
  - habboPixelAgents.kanbanSource VS Code setting (enum: github|azuredevops, default: github)
  - habboPixelAgents.azureDevOps.* VS Code settings (organization, project, pat, pollIntervalSeconds)
  - readAzureDevOpsConfig function in extension.ts with .vscode/settings.json fallback
  - kanbanSource-aware polling switch in extension.ts (github or azuredevops, backward compatible)
requires: []
affects: []
key_files: []
key_decisions:
  - "Use native fetch (not node-fetch) for Azure DevOps REST API calls — Node 22 has built-in fetch; no new dependencies needed"
  - "vi.stubGlobal('fetch', vi.fn()) for mocking — fetch is a global in Node 22, not a module import; vi.mock would not work"
  - "WIQL query filters Closed and Removed at source — batch response filter for Removed is a safety net for future WIQL changes"
  - "ID capped at 100 before batch call — Azure DevOps workitemsbatch API limit; silent truncation matches silent-fallback pattern"
  - "kanbanSource defaults to 'github' — all existing GitHub Projects users unaffected"
  - "Azure DevOps polling guarded by org + project + pat all non-empty AND pollIntervalSeconds > 0"
  - "void + .then() instead of async IIFE in setInterval — matches plan pitfall guidance"
  - "readAzureDevOpsConfig mirrors readKanbanConfig structure for consistency"
patterns_established:
  - "Azure DevOps REST API pattern: POST WIQL → extract IDs → POST workitemsbatch with fields projection"
  - "Basic auth header: Buffer.from(':' + pat).toString('base64') — colon-prefixed PAT per Azure DevOps spec"
  - "VS Code settings fallback: getConfiguration first, .vscode/settings.json if empty"
  - "kanbanSource switch pattern: string enum gates which data source is polled"
observability_surfaces: []
drill_down_paths: []
duration: 2min
verification_result: passed
completed_at: 2026-03-10
blocker_discovered: false
---
# S16: Azure Devops Boards Integration

**# Phase 17.6 Plan 01: Azure DevOps Boards Fetch Module Summary**

## What Happened

# Phase 17.6 Plan 01: Azure DevOps Boards Fetch Module Summary

**Azure DevOps work item fetch via WIQL + workitemsbatch REST API with state mapping to KanbanCard[], 16 unit tests, no new npm dependencies**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T17:41:52Z
- **Completed:** 2026-03-10T17:44:09Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Implemented `fetchAzureDevOpsCards(organization, project, pat)` using the two-step WIQL → workitemsbatch REST API pattern
- Implemented `mapAzureDevOpsState` covering all Azure DevOps process template states (New, Proposed, Approved, Active, Committed, In Progress, Resolved, Done, Closed, Removed, custom)
- 16 unit tests covering happy path, error branches (network, 401, empty config), state mapping, ID capping, URL construction, and authorization header
- Full test suite still green: 427 tests passing (up from 410)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD — Azure DevOps fetch module with state mapping** - `cb47b5d` (feat)

**Plan metadata:** (pending docs commit)

_Note: TDD tasks — RED (failing test file) confirmed, GREEN (implementation) passing all 16 tests_

## Files Created/Modified
- `src/azureDevOpsBoards.ts` - Azure DevOps fetch module with fetchAzureDevOpsCards and mapAzureDevOpsState exports
- `tests/azureDevOpsBoards.test.ts` - 16 unit tests covering all behaviors and error paths

## Decisions Made
- Used native fetch (Node 22 global) instead of any HTTP library — no new npm dependencies
- Used `vi.stubGlobal('fetch', vi.fn())` for test mocking — correct approach for native globals vs vi.mock
- WIQL WHERE clause filters Closed and Removed at source; batch response filter for Removed is an additional safety net
- Work item IDs capped at 100 before batch call per Azure DevOps API limit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required at this stage. Azure DevOps PAT and org/project settings will be wired into VS Code settings in a subsequent plan.

## Next Phase Readiness
- `fetchAzureDevOpsCards` module is complete and tested, ready for VS Code settings integration and polling wiring
- Module mirrors githubProjects.ts pattern exactly — integration into extension host follows the same kanban polling flow

---
*Phase: 17.6-azure-devops-boards-integration*
*Completed: 2026-03-10*

## Self-Check: PASSED

- FOUND: src/azureDevOpsBoards.ts
- FOUND: tests/azureDevOpsBoards.test.ts
- FOUND: .planning/phases/17.6-azure-devops-boards-integration/17.6-01-SUMMARY.md
- FOUND: commit cb47b5d

# Phase 17.6 Plan 02: Azure DevOps Extension Wiring Summary

**VS Code settings for Azure DevOps (org/project/PAT/poll) added to package.json, kanbanSource selector gates GitHub vs Azure DevOps polling in extension.ts with full backward compatibility**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T17:48:17Z
- **Completed:** 2026-03-10T17:50:13Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added 5 new VS Code settings to package.json: kanbanSource selector and 4 Azure DevOps config fields (org, project, PAT, poll interval)
- Implemented `readAzureDevOpsConfig` in extension.ts with .vscode/settings.json fallback (mirrors readKanbanConfig pattern)
- Replaced single-source GitHub polling block with kanbanSource-aware switch — default "github" is fully backward compatible
- Azure DevOps polling uses `void fetchAzureDevOpsCards(...).then(cards => postMessage)` pattern for async safety in setInterval
- All 427 tests still passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Azure DevOps settings and kanbanSource selector to package.json** - `4ca7370` (feat)
2. **Task 2: Wire Azure DevOps polling into extension.ts with kanbanSource switch** - `525932b` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `package.json` - Added habboPixelAgents.kanbanSource, habboPixelAgents.azureDevOps.organization, habboPixelAgents.azureDevOps.project, habboPixelAgents.azureDevOps.pat, habboPixelAgents.azureDevOps.pollIntervalSeconds
- `src/extension.ts` - Added fetchAzureDevOpsCards import, AzureDevOpsConfig interface, readAzureDevOpsConfig function, kanbanSource-aware polling switch

## Decisions Made
- `kanbanSource` defaults to `"github"` for full backward compatibility — no existing users affected
- Azure DevOps polling only starts when all three required fields (org, project, PAT) are non-empty AND pollIntervalSeconds > 0
- Used `void + .then()` pattern for async polling in setInterval (not async IIFE) per plan guidance on avoiding unhandled promise rejection
- `readAzureDevOpsConfig` mirrors `readKanbanConfig` structure identically — consistent pattern for future maintainers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in tests/messageBridge.test.ts (3 errors, unrelated to these changes — confirmed by stashing and verifying same errors existed before). These are out-of-scope pre-existing issues, not caused by this plan.

## User Setup Required

None for this plan. To use Azure DevOps integration, users set:
- `habboPixelAgents.kanbanSource` to `"azuredevops"`
- `habboPixelAgents.azureDevOps.organization` to their ADO org name
- `habboPixelAgents.azureDevOps.project` to their project name
- `habboPixelAgents.azureDevOps.pat` to a PAT with read:work items scope (user settings only, not workspace settings)

## Next Phase Readiness
- Azure DevOps end-to-end integration is complete — users can switch kanbanSource to azuredevops and work items appear as sticky notes on room walls
- Phase 17.6 is fully complete (Plan 01: fetch module + tests; Plan 02: settings + wiring)

---
*Phase: 17.6-azure-devops-boards-integration*
*Completed: 2026-03-10*
