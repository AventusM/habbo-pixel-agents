# M004: Azure DevOps Board → Habbo Room Website

**Vision:** A standalone website that visualises Azure DevOps board tickets as a live Habbo-style isometric room — tickets appear as wall sticky notes, GitHub coding agents working on tickets appear as animated avatars at desks, and ticket progress (sub-tasks, PRs, state changes) is visible in real time.

## Success Criteria

- Opening `http://localhost:3000` shows the isometric Habbo room with avatars and furniture
- Azure DevOps tickets from a configured board appear as wall sticky notes grouped by status (todo/doing/done)
- Clicking a sticky note shows ticket details including sub-tasks and linked PRs
- When a GitHub coding agent is working on a ticket, an avatar appears in the room and animates based on agent activity
- The existing VS Code extension continues to work unchanged

## Key Risks / Unknowns

- **Renderer extraction** — the Canvas 2D room renderer is tightly coupled to VS Code webview messaging and asset loading via `panel.webview.asWebviewUri()`. Decoupling without duplicating may be harder than expected.
- **Live data transport** — JSONL file watching only works on the local filesystem via Node.js. The browser needs a real-time data feed (WebSocket/SSE) from a local server.
- **Azure DevOps hierarchy depth** — current integration fetches flat work items only. Fetching child items, linked PRs, and state transitions requires additional API calls and a richer data model.
- **Coding agent ↔ ticket correlation** — mapping a GitHub coding agent's branch/PR activity back to the Azure DevOps ticket it's working on may require naming conventions or explicit linking.

## Proof Strategy

- **Renderer extraction** → retire in S01 by proving the room renders identically in a standalone HTML page with the same Canvas 2D code
- **Live data transport** → retire in S02 by proving agent spawn/status/tool events flow from JSONL watcher through WebSocket to browser and animate avatars
- **Azure DevOps hierarchy** → retire in S03 by proving sub-tasks and linked PRs appear in expanded ticket view
- **Coding agent ↔ ticket correlation** → retire in S04 by proving an active coding agent avatar is visually linked to its ticket sticky note

## Verification Classes

- Contract verification: unit tests for API modules, data transforms, WebSocket message schemas
- Integration verification: local server + browser rendering the room with live Azure DevOps data
- Operational verification: server start/stop, WebSocket reconnection, graceful degradation when Azure DevOps is unreachable
- UAT / human verification: visual correctness of the room, sticky notes, and avatar animations in browser

## Milestone Definition of Done

This milestone is complete only when all are true:

- `npm run web` (or similar) starts a local server that serves the Habbo room at localhost
- Azure DevOps tickets from a configured board render as sticky notes on the room walls
- GitHub coding agent activity appears as animated avatars in the room
- Clicking tickets shows sub-task breakdown and linked PR status
- VS Code extension works exactly as before (no regressions)
- End-to-end flow verified in browser with real Azure DevOps data

## Requirement Coverage

- Covers: (new requirements to be created for M004)
- Partially covers: existing kanban rendering (R-kanban from M002/S04, S16)
- Leaves for later: cloud deployment, multi-user access, authentication UI
- Orphan risks: none

## Slices

- [ ] **S11: Fix Copilot Agent Streaming Fallback & ADO PR-Opened State Sync** `risk:medium` `depends:[S10, S07]`
  > After this: Copilot agent speech bubbles update in real time (not 15s stale polls) with visible feed mode indicators, and opening a Copilot PR reliably moves the linked ADO ticket to "Doing" via server-side sync.

- [ ] **S07: Copilot Agent Activity Monitor Workflow** `risk:low` `depends:[S06]`
  > After this: A GitHub Actions workflow watches Copilot agent PR activity and posts status updates as PR comments + syncs ADO work item state (To Do → Doing → Done) automatically. No human watching required.

- [x] **S08: Copilot Agent Rich Activity Display** `risk:low` `depends:[S06]`
  > After this: The Copilot agent avatar speech bubble on localhost:3000 shows detailed activity — commit messages, phase (coding/responding/planning), and progress — instead of a generic "Working..." message.

- [x] **S10: Real-Time SSE Streaming for Copilot Agent Activity** `risk:low` `depends:[S09]`
  > After this: Copilot agent speech bubbles update within ~2s of agent activity via persistent SSE connections to the Copilot sessions API, instead of polling every 15s.

- [x] **S01: Standalone Room Renderer** `risk:high` `depends:[]`
  > After this: Opening a local HTML page in a browser shows the full isometric Habbo room with furniture, camera controls, and placeholder avatars — no VS Code required.

- [x] **S02: Local WebSocket Server & Agent Feed** `risk:high` `depends:[S01]`
  > After this: A local Node.js server watches JSONL transcript files and pushes agent events over WebSocket. Avatars in the browser room spawn, move, and animate based on real coding agent activity.

- [x] **S03: Azure DevOps Deep Ticket Integration** `risk:medium` `depends:[S01]`
  > After this: The server fetches Azure DevOps work items including sub-tasks and linked PRs. Sticky notes on the room walls show ticket hierarchy — clicking expands to show sub-task progress and PR status.

- [x] **S04: Coding Agent ↔ Ticket Linking** `risk:medium` `depends:[S02, S03]`
  > After this: When a GitHub coding agent works on a ticket, its avatar in the room is visually linked to that ticket's sticky note — a line or highlight connects them, and the ticket note shows "agent working" state.

- [x] **S05: Website Polish & Integrated Experience** `risk:low` `depends:[S04]`
  > After this: The website has a clean layout with the room as the centrepiece, a sidebar or overlay for ticket details, real-time status indicators, and smooth transitions. Full end-to-end flow verified with real Azure DevOps data and coding agent activity.

- [x] **S06: GitHub Copilot Coding Agent Monitor** `risk:medium` `depends:[S02, S04]`
  > After this: When a GitHub Copilot coding agent is working on a PR, an avatar appears in the room, animates based on workflow run status, and links to the associated Azure DevOps ticket.

## Boundary Map

### S01 → S02

Produces:
- `RoomRenderer` class/module that accepts agent events and kanban cards via a typed interface (not VS Code messages)
- Asset loading via relative URLs (not webview URIs)
- `RoomDataPort` interface defining the contract for feeding data into the renderer

Consumes:
- nothing (first slice)

### S01 → S03

Produces:
- `RoomDataPort.updateKanbanCards(cards: KanbanCard[])` method on the renderer interface
- Extended `KanbanCard` type with optional `children`, `linkedPrs`, `assignee` fields

Consumes:
- nothing (first slice)

### S02 → S04

Produces:
- WebSocket server with typed message protocol for agent events
- Agent lifecycle events flowing from JSONL watcher to browser

Consumes:
- `RoomDataPort` interface from S01

### S03 → S04

Produces:
- Enriched Azure DevOps data model with work item hierarchy and PR links
- Server-side polling/caching of Azure DevOps API

Consumes:
- `RoomDataPort.updateKanbanCards()` from S01

### S04 → S05

Produces:
- Agent-to-ticket correlation logic (branch name → work item mapping)
- Visual link rendering between avatars and sticky notes

Consumes:
- Agent feed from S02
- Enriched ticket data from S03
