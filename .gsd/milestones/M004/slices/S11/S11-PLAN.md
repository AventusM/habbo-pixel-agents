# S11: Fix Copilot Agent Streaming Fallback & ADO PR-Opened State Sync

**Goal:** Copilot agent speech bubbles update in real time (not 15s stale polls) with clear visibility into the data feed mode, and opening a Copilot PR moves the linked ADO ticket to "Doing" reliably.
**Demo:** (1) A running Copilot agent's speech bubble updates within seconds; the status bar or agent overlay shows "SSE" vs "polling" per agent. (2) When a Copilot agent opens a PR with AB#NNN, the linked ADO work item moves to "Doing" within 60s.

## Must-Haves

- Copilot agent activity reaches the browser within seconds of the tool call, not 15s
- When SSE fails, the fallback is visible: server logs state the reason per agent, browser shows feed mode
- ADO work item transitions to "Doing" when Copilot opens a PR (not just on merge/close)
- No regressions to existing poll-based agent discovery, PR/workflow status, or merge→Done flow

## Proof Level

- This slice proves: integration
- Real runtime required: yes (needs a running Copilot agent or mock SSE/PR data)
- Human/UAT required: yes (verify speech bubble timing and ADO state change visually)

## Verification

- Build passes: `node esbuild.config.mjs && node esbuild.config.mjs web`
- All existing tests pass: `npx vitest run`
- New/updated tests pass: `npx vitest run --grep "copilot|ado|azureDevOps"`
- Server console logs show feed mode per agent: `[CopilotMonitor] PR #N: feed=sse` or `[CopilotMonitor] PR #N: feed=poll (reason: ...)`
- Browser status bar or agent overlay shows feed mode indicator per agent
- ADO state sync: when a Copilot PR is opened with AB#NNN in the title, the server-side monitor transitions the ADO work item to "Doing" within one poll cycle

## Observability / Diagnostics

- Runtime signals: `[CopilotMonitor] PR #N: feed=sse|poll (reason)` on every poll cycle; `[CopilotMonitor] ADO #NNN → Doing` on PR-opened state sync
- Inspection surfaces: server console output, browser status bar feed mode indicator
- Failure visibility: SSE fallback reason logged per agent per poll cycle (not just on initial failure), ADO update HTTP status logged
- Redaction constraints: auth tokens never logged

## Integration Closure

- Upstream surfaces consumed: `CopilotAgentMonitor` in `src/web/copilotMonitor.ts`, WebSocket broadcast in `scripts/web-server.mjs`, `fetchAzureDevOpsCards` in `src/azureDevOpsBoards.ts`
- New wiring introduced: server-side ADO state update on PR-opened, feed mode metadata in WebSocket messages, browser-side feed mode display
- What remains before the milestone is truly usable end-to-end: nothing — this fixes the two broken paths from S10 and S07

## Tasks

- [ ] **T01: Diagnose and fix SSE streaming reliability** `est:1.5h`
  - Why: S10 added SSE streaming but it silently falls back to 15s polling in practice. The likely failure points are: `resolveCopilotSessionId()` returning null (session not in first 50 results, or PR number doesn't match), the sessions API returning the full body and closing (not a true persistent stream), or auth header format rejected by the SSE endpoint. Need to identify which failure mode is happening and fix it, plus add a faster poll fallback if SSE genuinely can't work.
  - Files: `src/web/copilotMonitor.ts`
  - Do:
    - Add structured logging to `resolveCopilotSessionId()`: log how many sessions were returned, whether any matched, and the match criteria that failed
    - Add structured logging to `runSSEStream()`: log response headers (especially `content-type` and `transfer-encoding`) to confirm the endpoint is actually streaming
    - If the SSE endpoint returns the full body and closes (i.e., `done=true` after first read), detect this and switch to a fast re-fetch loop (e.g. every 3s) instead of waiting for the next 15s poll
    - Add a `feedMode` field to `CopilotAgentSession`: `'sse' | 'poll' | 'fast-poll'` with a `feedReason` string explaining why
    - Log feed mode per agent on each poll cycle: `[CopilotMonitor] PR #N: feed=sse` or `[CopilotMonitor] PR #N: feed=poll (no session ID — 47 sessions checked, none matched PR #N)`
    - If SSE works but is slow to connect, don't block — the poll cycle should still emit the latest snapshot while SSE is connecting
  - Verify: `npx vitest run --grep "copilot"` — existing + new tests pass; server logs show feed mode
  - Done when: Server logs clearly show why each agent is on SSE vs poll, and if SSE works, speech bubbles update within seconds

- [ ] **T02: Browser feed mode visibility** `est:45m`
  - Why: The browser currently has zero indication whether agent data is real-time or 15s stale. When things break, the user has no signal except visually noticing stale bubbles.
  - Files: `src/web/copilotMonitor.ts`, `src/agentTypes.ts`, `src/web/wsClient.ts`, `src/web/main.tsx`
  - Do:
    - Add `feedMode` to the `agentTool` or a new `agentFeedMode` message type in `ExtensionMessage`
    - Broadcast feed mode changes over WebSocket alongside existing agent events
    - In the browser, display feed mode per agent — either in the status bar (compact) or as a small icon/label near the agent's speech bubble
    - Use distinct visual treatment: SSE = green dot or "live" label, poll = yellow dot or "15s" label, fast-poll = orange dot or "3s" label
  - Verify: `node esbuild.config.mjs web` builds cleanly; browser shows feed mode indicator when connected to a running server
  - Done when: Opening localhost:3000 with a running Copilot agent shows whether that agent's data is streaming or polling

- [ ] **T03: Server-side ADO state sync on PR-opened** `est:1h`
  - Why: The GitHub Actions workflow (`copilot-agent-monitor.yml`) triggers on `pull_request: opened`, but Copilot-created PRs may not fire this event for user workflows (GitHub App context). The merge→Done path works because a human triggers the merge. The fix is to also sync ADO state from the server-side `CopilotAgentMonitor` which already detects new PRs.
  - Files: `src/web/copilotMonitor.ts`, `src/azureDevOpsBoards.ts`
  - Do:
    - When `CopilotAgentMonitor.poll()` discovers a new Copilot PR with a `linkedTicketId`, and `isRunning` is true, call the ADO REST API to transition the work item to "Doing"
    - Extract ADO update logic into a reusable function (or import from `azureDevOpsBoards.ts`): `PATCH /wit/workitems/{id}` with `System.State` → target state
    - Add ADO config (org, project, PAT) to `CopilotAgentMonitor` constructor or make it available via a callback
    - Guard against duplicate updates: track which tickets have already been transitioned to "Doing" in the current session
    - Log the result: `[CopilotMonitor] ADO #NNN → Doing (PR #M opened)` or `[CopilotMonitor] ADO #NNN update failed: HTTP 4xx`
    - Keep the GitHub Actions workflow as a secondary/redundant path — it still works for merge→Done and may eventually work for opened too
  - Verify: `npx vitest run --grep "ado\|azureDevOps\|copilot"` — tests pass; server logs show ADO state transition when a new Copilot PR is detected with a linked ticket
  - Done when: When a Copilot agent opens a PR with AB#NNN in the title, the server-side monitor logs a successful ADO state update to "Doing" within one poll cycle, and the kanban board in the browser reflects the change on the next ADO poll

## Files Likely Touched

- `src/web/copilotMonitor.ts`
- `src/agentTypes.ts`
- `src/azureDevOpsBoards.ts`
- `src/web/main.tsx`
- `scripts/web-server.mjs`
- `tests/copilotMonitor.test.ts`
