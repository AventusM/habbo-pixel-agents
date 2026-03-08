---
phase: quick-2
plan: 01
subsystem: extension
tags: [fs.watch, subagents, jsonl, agent-discovery]

requires:
  - phase: 16-agent-factory-workflow
    provides: AgentManager with JSONL-based agent discovery
provides:
  - Sub-agent discovery from session/subagents/ subdirectories
  - Runtime detection of new subagents dirs and JSONL files
affects: [agent-factory-workflow, orchestration-ui]

tech-stack:
  added: []
  patterns: [nested fs.watch with automatic cleanup, session-dir-to-subagents watcher promotion]

key-files:
  created: []
  modified: [src/agentManager.ts]

key-decisions:
  - "Session dir watchers self-close when subagents/ dir appears (watcher promotion pattern)"
  - "All watchers keyed with __sessiondir__ and __subagentsdir__ prefixes in this.watchers map for automatic dispose()"

patterns-established:
  - "Nested directory watching: top-level -> session dir -> subagents dir -> JSONL files"

requirements-completed: [QUICK-2]

duration: 1min
completed: 2026-03-08
---

# Quick Task 2: Watch Subagents Subdirectories Summary

**AgentManager discovers and watches sub-agent JSONL files in session/{uuid}/subagents/ subdirectories with three-level fs.watch hierarchy**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-08T20:05:48Z
- **Completed:** 2026-03-08T20:06:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Sub-agent JSONL files in existing session/subagents/ dirs are discovered on startup
- New session directories detected and watched for subagents/ subdirs appearing
- New .jsonl files in subagents/ dirs detected and tracked at runtime
- All watchers stored in this.watchers map for automatic cleanup on dispose()

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sub-agent discovery and watching to AgentManager** - `3df25a6` (feat)

## Files Created/Modified
- `src/agentManager.ts` - Added subagents directory scanning in discoverAgents(), watchSessionDirForSubagents() and watchSubagentsDir() private methods, updated top-level watcher to detect new session directories

## Decisions Made
- Session-level watchers self-close once the subagents/ dir appears (watcher promotion) to avoid unnecessary overhead
- Watchers use descriptive key prefixes (__sessiondir__, __subagentsdir__) to avoid collisions in the watchers map

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sub-agents are now fully discoverable; orchestration UI will display them automatically
- No blockers
