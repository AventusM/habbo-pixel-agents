---
id: T02
parent: S16
milestone: M002
provides:
  - habboPixelAgents.kanbanSource VS Code setting (enum: github|azuredevops, default: github)
  - habboPixelAgents.azureDevOps.* VS Code settings (organization, project, pat, pollIntervalSeconds)
  - readAzureDevOpsConfig function in extension.ts with .vscode/settings.json fallback
  - kanbanSource-aware polling switch in extension.ts (github or azuredevops, backward compatible)
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 2min
verification_result: passed
completed_at: 2026-03-10
blocker_discovered: false
---
# T02: 17.6-azure-devops-boards-integration 02

**# Phase 17.6 Plan 02: Azure DevOps Extension Wiring Summary**

## What Happened

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
