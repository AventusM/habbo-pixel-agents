---
status: done
started: 2026-03-22
completed: 2026-03-22
---

# S09 Summary — Live Session Activity in Speech Bubbles

## What changed

Replaced the commit-message-based speech bubble display with live activity from the Copilot session logs API (`api.githubcopilot.com`).

### Before
- `Coding... (last: "Initial plan")`
- `Done — 3 commits: "fix linting errors"`

### After
- `Reading isoSpriteCache.ts`
- `Running tests`
- `Searching: tests/**/*.test.ts`
- `Editing pixelLabAvatarRenderer.ts`
- `Let me explore the codebase to understand...`

Falls back to `Coding: <PR title>` when the session API is unavailable.

## Key decisions

- Uses the same Copilot sessions API that powers the GitHub `/agents/pull/N` page
- SSE stream is fetched in full, then scanned from the end for the last real tool call
- Setup steps (`run_custom_setup_step`, `run_setup`, `report_progress`) are filtered out
- Session IDs are cached per PR number to avoid redundant lookups
- API availability flag (`sessionApiAvailable`) prevents repeated 401/403 failures

## Files changed

- `src/web/copilotMonitor.ts` — added session logs integration, tool call parser, formatter

## Verification

- Build clean
- 373/373 tests pass
