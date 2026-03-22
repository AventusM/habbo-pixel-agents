---
status: done
started: 2026-03-22
completed: 2026-03-22
---

# S11 Summary — Fix Copilot Agent Streaming Fallback & ADO PR-Opened State Sync

## What changed

### Before
- SSE streaming (added in S10) silently fell back to 15s main poll when the Copilot sessions API returned a body dump instead of a persistent stream — no indication to user or server logs
- `resolveCopilotSessionId()` logged a single line on miss ("no session ID") with no diagnostics about why
- When Copilot opened a PR, the ADO ticket stayed in "To Do" — the GitHub Actions workflow `pull_request: opened` trigger doesn't fire for Copilot-created PRs (GitHub App context)
- Browser had zero visibility into whether agent data was real-time or 15s stale

### After
- **Fast-poll fallback (3s):** When SSE connection closes quickly (< 10s, indicating body dump not persistent stream), automatically starts a 3s re-fetch timer for that agent instead of waiting 15s
- **Structured logging:** Every feed mode change logs `[CopilotMonitor] PR #N: feed=sse|fast-poll|poll (reason)`. `resolveCopilotSessionId()` logs session count, match criteria, and specific mismatch details. `runSSEStream()` logs response headers and stream duration/event count.
- **Server-side ADO sync:** When `poll()` discovers a new Copilot PR with `linkedTicketId` and `isRunning=true`, directly PATCHes the ADO work item to "Doing" via REST API. Dedup guard prevents repeated updates.
- **Browser feed mode indicators:** Status bar shows per-agent feed mode: 🟢 live (SSE), 🟠 3s (fast-poll), 🟡 15s (poll) with PR number labels

## Key decisions

- `FeedMode` type (`'sse' | 'fast-poll' | 'poll'`) added to `CopilotAgentSession` with `feedReason` string
- Fast-poll uses the existing `fetchLiveActivity()` path at 3s intervals — same data source, just faster
- `agentFeedMode` added to the `ExtensionMessage` union type — broadcast over WebSocket like other agent events
- ADO state sync happens in `CopilotAgentMonitor` (not a separate module) since it already has the PR lifecycle context
- `adoTransitionedToDoing` set tracks per-session which tickets have been moved, preventing duplicate PATCHes
- ADO config passed into `CopilotAgentMonitor` constructor as optional param — monitor works without it
- GitHub Actions workflow kept as redundant secondary path (still works for merge→Done)

## Files changed

- `src/web/copilotMonitor.ts` — `FeedMode` type, `setFeedMode()`, `startFastPoll()`, `stopFastPoll()`, `updateAdoWorkItemState()`, improved `resolveCopilotSessionId()` logging, `runSSEStream()` diagnostics, `poll()` ADO sync on new PR + fast-poll awareness
- `src/agentTypes.ts` — added `agentFeedMode` to `ExtensionMessage` union
- `src/web/server.ts` — `createCopilotMonitor()` now accepts `adoConfig` param
- `src/web/main.tsx` — `agentFeedModes` map, `extensionMessage` listener for `agentFeedMode`, `buildFeedModeIndicators()` in status bar
- `scripts/web-server.mjs` — passes ADO config to copilot monitor, sends `agentFeedMode` on WS connect
- `tests/copilotMonitor.test.ts` — 5 new tests: `FeedMode` type validation, `updateAdoWorkItemState` (no config, success, HTTP error, network error)

## Verification

- Both builds clean: `node esbuild.config.mjs` and `node esbuild.config.mjs web`
- 431/431 tests pass (5 new)
- Server logs structured feed mode per agent on every transition
- Browser status bar shows feed mode indicators per agent
