---
status: done
started: 2026-03-22
completed: 2026-03-22
---

# S10 Summary — Real-Time SSE Streaming for Copilot Agent Activity

## What changed

Replaced the poll-and-fetch-entire-body pattern for Copilot session activity with persistent SSE streaming connections. Speech bubble updates now arrive within ~2s of agent tool calls instead of every 15s.

### Before
- Every 15s: `fetch()` → `await res.text()` → `parseLastToolCall(entireBody)` — re-downloads and re-parses the full SSE log each cycle

### After
- On agent start: `fetch()` → `res.body.getReader()` → incremental read loop processes `data:` lines as they arrive
- Each new tool call emits `agentTool`/`agentStatus` messages immediately
- 15s poll still runs for PR discovery, workflow status, and non-running agent state
- Poll skips `getActivitySnapshot()` for agents with active SSE streams (avoids redundant fetches)

### Lifecycle
- SSE opens when `session.isRunning` transitions to `true` (or on first discovery of an already-running agent)
- SSE closes when agent stops running, is removed, or `stop()` is called
- On SSE failure (network error, 401/403), silently falls back to existing poll-based `fetchLiveActivity()`

## Key decisions

- `parseSingleSSEEvent()` extracted as a standalone function — processes one `data:` line at a time, same filtering rules as `parseLastToolCall` (skips `run_setup`, `report_progress`, PR metadata)
- `SSEConnection` type tracks `AbortController` + `connected` flag per agent
- Stream reading uses `ReadableStream.getReader()` + `TextDecoder` with a line buffer — handles partial chunks correctly
- Existing `fetchLiveActivity()` is preserved untouched as the fallback path
- `hasActiveSSE()` method lets the poll cycle check whether to skip snapshot fetching

## Files changed

- `src/web/copilotMonitor.ts` — added `SSEConnection`, `parseSingleSSEEvent()`, `openSSEStream()`, `runSSEStream()`, `closeSSEConnection()`, `closeAllSSEConnections()`, `hasActiveSSE()`; modified `poll()` to skip snapshot for SSE-connected agents, `stop()` to close all SSE
- `tests/copilotMonitor.test.ts` — added 14 tests for `parseSingleSSEEvent`, including consistency test with `parseLastToolCall`

## Verification

- Build clean (both `node esbuild.config.mjs` and `node esbuild.config.mjs web`)
- 426/426 tests pass (14 new for SSE parser)
- Console logging confirms SSE lifecycle: `SSE connected for PR #N`, `SSE closed for PR #N`
