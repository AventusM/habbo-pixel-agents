# S10: Real-Time SSE Streaming for Copilot Agent Activity

**Goal:** Replace the poll-and-fetch-entire-log pattern for Copilot session activity with persistent SSE connections that stream tool calls in real time, so speech bubble updates arrive within seconds instead of every 15s.
**Demo:** While a Copilot coding agent is active, the avatar's speech bubble updates within ~2s of the agent performing a tool call (reading a file, running a command, editing code).

## Must-Haves

- Persistent SSE connection to `api.githubcopilot.com/agents/sessions/:id/logs` for each running agent
- Incremental parsing — process new SSE events as they arrive, don't re-parse the full body
- Automatic lifecycle: open SSE when agent starts running, close when agent stops
- Graceful fallback to current poll-based fetch when SSE connection fails or API is unavailable
- No regressions — 15s polling still drives PR discovery, workflow run status, and non-running agent state

## Proof Level

- This slice proves: integration
- Real runtime required: yes (needs a running Copilot agent or manual SSE mock)
- Human/UAT required: yes (verify speech bubble timing visually)

## Verification

- Build passes: `node esbuild.config.mjs`
- All existing tests pass: `npx vitest run`
- New unit tests for incremental SSE parser: `npx vitest run --grep "SSE"`
- Console log shows `[CopilotMonitor] SSE connected for PR #N` when agent is running
- Console log shows `[CopilotMonitor] SSE closed for PR #N` when agent stops

## Observability / Diagnostics

- Runtime signals: `[CopilotMonitor] SSE connected/closed/error` console logs with PR number
- Inspection surfaces: console output from web-server process
- Failure visibility: SSE error logged with status code, falls back to poll-based fetch silently
- Redaction constraints: auth tokens never logged

## Integration Closure

- Upstream surfaces consumed: `CopilotAgentMonitor` class in `src/web/copilotMonitor.ts`, WebSocket broadcast in `scripts/web-server.mjs`
- New wiring introduced in this slice: SSE connection manager inside `CopilotAgentMonitor`, incremental SSE parser
- What remains before the milestone is truly usable end-to-end: nothing — this is a transparent upgrade to an existing data path

## Tasks

- [ ] **T01: Incremental SSE parser and streaming connection manager** `est:1.5h`
  - Why: The current `fetchLiveActivity()` method fetches the entire SSE body on every poll cycle and re-parses it from the end. For real-time updates, we need to maintain an open connection and parse events incrementally as they arrive.
  - Files: `src/web/copilotMonitor.ts`
  - Do:
    - Add an `SSEStreamManager` (or similar) that manages per-agent SSE connections
    - Use `fetch()` with streaming response body (`res.body` as `ReadableStream`) to consume SSE events incrementally
    - Parse each `data: {json}\n\n` chunk as it arrives, extract tool calls using the existing `parseLastToolCall` logic adapted for single events
    - On each new tool call, emit `agentTool` + `agentStatus` messages via the existing `onMessage` callback
    - Track connection state per agent: `connecting | connected | closed | error`
    - Open SSE when `session.isRunning` transitions to `true` (or on startup for already-running agents)
    - Close SSE when `session.isRunning` transitions to `false` or agent is removed
    - If SSE connect fails or stream errors, mark that agent as SSE-unavailable and let the existing poll-based `fetchLiveActivity()` handle it
    - Existing poll cycle (`poll()`) still runs at 15s for PR/workflow discovery — it just skips `getActivitySnapshot()` for agents that have an active SSE stream
  - Verify: `npx vitest run --grep "SSE"` — unit tests for the incremental parser with mock SSE data
  - Done when: SSE connections open/close based on agent running state, tool call events emit within seconds of arriving on the stream

- [ ] **T02: Integration wiring and verification** `est:30m`
  - Why: Wire the SSE manager into the existing poll lifecycle and verify end-to-end with a running server.
  - Files: `src/web/copilotMonitor.ts`
  - Do:
    - In `poll()`, skip `getActivitySnapshot()` for agents with an active SSE stream (SSE is already pushing updates)
    - In `stop()`, close all active SSE connections
    - Add console logging: connection opened, closed, errored, fallback to polling
    - Verify `esbuild` builds cleanly with the new streaming code (Node.js `fetch` + `ReadableStream` available since Node 18)
  - Verify: `node esbuild.config.mjs && npx vitest run` — full build + all tests pass
  - Done when: Build passes, all existing tests pass, server logs show SSE lifecycle messages when Copilot agents are active

## Files Likely Touched

- `src/web/copilotMonitor.ts`
- `src/web/copilotMonitor.test.ts` (new or extended)
