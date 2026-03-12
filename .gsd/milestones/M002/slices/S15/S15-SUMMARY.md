---
id: S15
parent: M002
milestone: M002
provides:
  - isAgentCompleted() exported function for JSONL completion detection
  - Auto-despawn of completed sub-agents in checkIdleAgents()
requires: []
affects: []
key_files: []
key_decisions:
  - "Exported isAgentCompleted as standalone function for direct testability instead of testing through class"
  - "15-second staleness threshold prevents despawning agents mid-response"
patterns_established:
  - "Tail-read pattern: read last 8KB of file for efficient last-line access on large JSONL files"
observability_surfaces: []
drill_down_paths: []
duration: 2min
verification_result: passed
completed_at: 2026-03-09
blocker_discovered: false
---
# S15: Auto Despawn Agents On Task Completion

**# Phase 17.5 Plan 01: Auto-Despawn Agents Summary**

## What Happened

# Phase 17.5 Plan 01: Auto-Despawn Agents Summary

**Completion detection via JSONL last-line end_turn check with 15s staleness guard, plus 6 unit tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T18:41:07Z
- **Completed:** 2026-03-09T18:43:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Exported `isAgentCompleted()` reads last JSONL line efficiently via tail-read (last 8KB)
- `checkIdleAgents()` auto-despawns agents with end_turn + 15s file staleness
- 6 unit tests covering all edge cases (end_turn, tool_use, user msg, empty, corrupt, missing)
- Full test suite green (410 tests passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add completion detection to AgentManager** - `ced6a2d` (feat)

## Files Created/Modified
- `src/agentManager.ts` - Added COMPLETION_STALENESS_MS constant, isAgentCompleted() exported function, completion check in checkIdleAgents()
- `tests/agentManager.test.ts` - 6 unit tests for isAgentCompleted covering all edge cases

## Decisions Made
- Exported isAgentCompleted as standalone function for direct testability instead of only as a private class method
- 15-second staleness threshold balances responsiveness with safety (avoids despawning mid-response agents)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Completion detection is live and integrated into the existing idle check loop
- No additional configuration or setup needed

---
*Phase: 17.5-auto-despawn-agents-on-task-completion*
*Completed: 2026-03-09*
