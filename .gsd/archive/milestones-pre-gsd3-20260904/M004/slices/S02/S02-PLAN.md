# S02: Local WebSocket Server & Agent Feed

**Goal:** A local Node.js server watches JSONL transcript files and pushes agent events over WebSocket. The standalone browser room shows real coding agent activity (spawn, status, tool use, despawn) without VS Code.
**Demo:** Start the web server while Claude Code agents are running. Avatars appear in the room as agents spawn, animate when they use tools, and despawn when they complete.

## Must-Haves

- WebSocket server pushes agent lifecycle events (created, status, tool, removed) to connected browsers
- Server reuses existing `AgentManager`, `fileWatcher`, `transcriptParser`, `agentClassifier` modules
- Web client auto-connects to WebSocket and dispatches events via the same `extensionMessage` protocol
- Graceful fallback: demo mode when no WebSocket connection or no real agents
- Existing VS Code extension unchanged

## Proof Level

- This slice proves: integration (real JSONL → WebSocket → browser avatar animation)
- Real runtime required: yes
- Human/UAT required: yes (avatar behavior matches agent activity)

## Verification

- `npm run web` starts HTTP + WebSocket server on port 3000
- WebSocket connects from browser (check console for "[WS] Connected")
- When a Claude Code agent is running, its avatar appears in the room
- Falls back to demo avatars when no real agents are active
- `npm run build` and `npx vitest run` still pass

## Tasks

- [x] **T01: WebSocket server with agent event relay** `est:1h`
  - Why: The server needs to watch JSONL files and push agent events to connected browsers over WebSocket
  - Files: `src/web/server.ts`, `scripts/web-server.mjs`
  - Do: Create `src/web/server.ts` that starts HTTP server (serves dist/web/), upgrades to WebSocket using `ws` package, instantiates `AgentManager` with the project directory, and relays all `ExtensionMessage` callbacks as WebSocket JSON messages. Merge into existing `scripts/web-server.mjs` or replace it. Add `ws` as a dependency.
  - Verify: `npm run web` starts server, WebSocket endpoint accessible at ws://localhost:3000
  - Done when: Server starts, watches JSONL files, and sends agent events to any connected WebSocket client

- [x] **T02: Browser WebSocket client** `est:30m`
  - Why: The browser needs to receive agent events from the WebSocket server and feed them to RoomCanvas
  - Files: `src/web/wsClient.ts`, `src/web/main.tsx`
  - Do: Create `src/web/wsClient.ts` that connects to ws://localhost:3000, parses incoming JSON messages, and dispatches them as `extensionMessage` CustomEvents. Auto-reconnect on disconnect. In `main.tsx`, start the WS client after assets load. If no real agents arrive within 5 seconds, start demo mode as fallback.
  - Verify: Browser console shows "[WS] Connected", real agent events appear if agents are running
  - Done when: WebSocket client connects, receives events, and dispatches them to RoomCanvas

- [x] **T03: Verify end-to-end and regression check** `est:15m`
  - Why: Prove the full pipeline works and nothing is broken
  - Files: none (verification only)
  - Do: Run existing tests, verify existing build, test with and without active agents
  - Verify: `npm run build` succeeds, `npx vitest run` passes, browser shows room
  - Done when: All verification passes

## Files Likely Touched

- `src/web/server.ts` (new)
- `src/web/wsClient.ts` (new)
- `src/web/main.tsx` (modify — add WS client)
- `scripts/web-server.mjs` (modify or replace — integrate WS server)
- `package.json` (add `ws` dependency)
