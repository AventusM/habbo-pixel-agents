---
status: complete
started: 2026-03-21
completed: 2026-03-21
---

# M004 Summary: Azure DevOps Board → Habbo Room Website

## What Was Built

A standalone website that renders the Habbo isometric room visualisation — previously locked inside a VS Code webview — as a live dashboard accessible via `http://localhost:3000`. It shows Azure DevOps ticket progress through animated agents and visual state.

## Slices Completed

### S01: Standalone Room Renderer ✅
Extracted the Canvas 2D room renderer from VS Code webview into a standalone browser page. Created `src/web/main.tsx`, `index.html`, and a zero-dependency dev server. All rendering code shared with VS Code extension — no duplication.

### S02: Local WebSocket Server & Agent Feed ✅
Added WebSocket server that relays agent events from JSONL file watching to connected browsers. Reuses existing AgentManager, fileWatcher, transcriptParser, and agentClassifier modules directly. Browser client auto-reconnects and falls back to demo mode.

### S03: Azure DevOps Deep Ticket Integration ✅
Extended KanbanCard with workItemType, assignee, children (sub-tasks), and linkedPrs. Azure DevOps fetcher retrieves child work items and linked PRs via the relations API. Expanded sticky note view shows sub-task progress bars and PR status.

### S04: Coding Agent ↔ Ticket Linking ✅
Added visual linking between agent avatars and tickets. Linked sticky notes glow green with a "WORKING" badge. Orchestration overlay shows linked ticket title next to agent name.

### S05: Website Polish & Integrated Experience ✅
Connection status bar, DEMO MODE indicator, emoji favicon. All features integrated.

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Share renderer code, don't duplicate | RoomCanvas.tsx imports work unchanged — only the entry point differs |
| `ws` as only new dependency | Minimal, well-maintained WebSocket library for Node.js |
| extensionMessage CustomEvent protocol | RoomCanvas already listens for this — no changes to rendering code needed |
| Demo fallback after 5s | Website always shows something interesting, even without active agents |
| AZDO_ORG/PROJECT/PAT env vars | Simple configuration without settings UI for v1 |

## Files Created

- `src/web/main.tsx` — Standalone entry point
- `src/web/index.html` — HTML shell with favicon
- `src/web/demoData.ts` — Demo agent + kanban simulator
- `src/web/server.ts` — AgentManager wrapper + kanban polling
- `src/web/wsClient.ts` — Browser WebSocket client with auto-reconnect
- `scripts/web-server.mjs` — HTTP + WebSocket dev server

## Files Modified

- `esbuild.config.mjs` — Added web build target
- `package.json` — Added build:web, web, web:serve scripts + ws dependency
- `src/agentTypes.ts` — Extended KanbanCard, added agentLinkedTicket message
- `src/azureDevOpsBoards.ts` — Deep ticket fetching with relations
- `src/isoKanbanRenderer.ts` — Enriched expanded notes, linked ticket highlighting
- `src/isoOrchestrationOverlay.ts` — Linked ticket display, getLinkedTicketIds
- `src/RoomCanvas.tsx` — agentLinkedTicket handler, linked ticket IDs to kanban renderer

## Verification

- All 373 existing tests pass — zero regressions
- VS Code extension build (`npm run build`) succeeds unchanged
- Website builds and serves correctly (`npm run web`)
- Room renders with floor, walls, furniture, camera controls, demo avatars
- WebSocket connects, demo mode activates, kanban sticky notes display
- End-to-end flow verified in browser

## How to Use

```bash
# Build and start the website
npm run web

# Or build separately
npm run build:web
npm run web:serve

# With Azure DevOps (optional)
AZDO_ORG=myorg AZDO_PROJECT=myproject AZDO_PAT=*** npm run web
```
