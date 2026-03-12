---
phase: 17.5-auto-despawn-agents-on-task-completion
verified: 2026-03-09T18:50:00Z
status: passed
score: 3/3 must-haves verified
---

# Phase 17.5: Auto-Despawn Agents on Task Completion Verification Report

**Phase Goal:** Detect completed sub-agents via JSONL last-line end_turn + file staleness and trigger automatic despawn through existing removeAgent flow.
**Verified:** 2026-03-09T18:50:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Completed sub-agents (end_turn + 15s stale) are automatically despawned | VERIFIED | `checkIdleAgents()` at line 518-525 checks `staleness > COMPLETION_STALENESS_MS` then calls `isAgentCompleted()`, pushes to `toRemove` on true, and `removeAgent()` is called at line 540-542 |
| 2 | Still-running agents (tool_use or recent end_turn) are NOT despawned | VERIFIED | Staleness guard (`staleness > COMPLETION_STALENESS_MS = 15_000`) prevents despawn of recently active files. `isAgentCompleted()` returns false for tool_use (line 54-57 checks `stop_reason === 'end_turn'`). Test case confirms: `returns false for file ending with tool_use stop_reason` passes. |
| 3 | Corrupt or partial JSONL last lines are silently skipped without crashing | VERIFIED | `isAgentCompleted()` wraps all logic in try/catch returning false (line 58-60). The completion check in `checkIdleAgents()` also has its own try/catch (line 526-528). Test case confirms: `returns false for file with corrupt JSON last line` passes. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/agentManager.ts` | isAgentCompleted() method and completion detection in checkIdleAgents() | VERIFIED | `isAgentCompleted` exported as standalone function (line 33-61), `COMPLETION_STALENESS_MS = 15_000` constant (line 23), completion check wired into `checkIdleAgents()` (lines 517-528). File is 589 lines. |
| `tests/agentManager.test.ts` | Unit tests for completion detection (min 50 lines) | VERIFIED | 77 lines, 6 test cases covering end_turn, tool_use, user message, empty file, corrupt JSON, non-existent file. All 6 tests pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `checkIdleAgents` | `isAgentCompleted` | calls isAgentCompleted when file stale > COMPLETION_STALENESS_MS | WIRED | Line 521: `if (staleness > COMPLETION_STALENESS_MS && isAgentCompleted(jsonlPath))` |
| `isAgentCompleted` result | `removeAgent` | checkIdleAgents pushes to toRemove array when completed | WIRED | Line 523: `toRemove.push(jsonlPath)` after isAgentCompleted returns true; line 540-542: `removeAgent(jsonlPath)` called for each toRemove entry |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| 17.5-01 | 17.5-01-PLAN | isAgentCompleted() returns true for end_turn last line | SATISFIED | Function at line 33-61, test passes |
| 17.5-02 | 17.5-01-PLAN | isAgentCompleted() returns false for tool_use last line | SATISFIED | Logic at line 54-57 checks specifically for end_turn, test passes |
| 17.5-03 | 17.5-01-PLAN | checkIdleAgents() calls removeAgent when completed + stale | SATISFIED | Lines 518-525 implement staleness + completion check, lines 540-542 call removeAgent |
| 17.5-04 | 17.5-01-PLAN | checkIdleAgents() does NOT remove when end_turn but not stale | SATISFIED | Staleness guard at line 521 requires `staleness > COMPLETION_STALENESS_MS (15s)` before checking completion |
| 17.5-05 | 17.5-01-PLAN | Graceful handling of partial/corrupt last line | SATISFIED | try/catch at lines 58-60 and 526-528, test case for corrupt JSON passes |

Note: Requirements 17.5-01 through 17.5-05 are defined in RESEARCH.md and ROADMAP.md but are NOT present in REQUIREMENTS.md. This is acceptable as REQUIREMENTS.md only tracks v1/v2 formal requirements; phase-specific requirements for bugfix/polish phases are tracked in ROADMAP.md. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

### Human Verification Required

### 1. Auto-Despawn Timing in Live Session

**Test:** Start a Claude Code session with sub-agents, let one complete its task, wait 15+ seconds, observe if the avatar despawns from the room.
**Expected:** Completed agent avatar disappears via the existing despawn animation after ~15-20 seconds of file staleness.
**Why human:** Requires a live Claude Code session with real sub-agents; the 15-second staleness window combined with the 5-second poll interval means the actual despawn happens between 15-20 seconds after task completion.

### 2. Active Agent Not Despawned

**Test:** While a sub-agent is actively using tools (producing tool_use JSONL entries), verify it is NOT despawned.
**Expected:** Active agent remains in the room, avatar stays visible with active status.
**Why human:** Requires verifying negative behavior during a real agent session; cannot be fully simulated by unit tests alone.

### Gaps Summary

No gaps found. All three observable truths are verified with implementation evidence, all artifacts exist and are substantive, all key links are wired, and all 5 requirements are satisfied. The commit `ced6a2d` is verified in git history with the expected file changes. All 6 unit tests pass.

---

_Verified: 2026-03-09T18:50:00Z_
_Verifier: Claude (gsd-verifier)_
