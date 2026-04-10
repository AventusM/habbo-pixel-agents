# M004: 

## Vision
TBD

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | Standalone Room Renderer | high | — | ✅ | Opening a local HTML page in a browser shows the full isometric Habbo room with furniture, camera controls, and placeholder avatars — no VS Code required. |
| S02 | Local WebSocket Server & Agent Feed | high | S01 | ✅ | A local Node.js server watches JSONL transcript files and pushes agent events over WebSocket. Avatars in the browser room spawn, move, and animate based on real coding agent activity. |
| S03 | Azure DevOps Deep Ticket Integration | medium | S01 | ✅ | The server fetches Azure DevOps work items including sub-tasks and linked PRs. Sticky notes on the room walls show ticket hierarchy — clicking expands to show sub-task progress and PR status. |
| S04 | Coding Agent ↔ Ticket Linking | medium | S02, S03 | ✅ | When a GitHub coding agent works on a ticket, its avatar in the room is visually linked to that ticket's sticky note — a line or highlight connects them, and the ticket note shows "agent working" state. |
| S05 | Website Polish & Integrated Experience | low | S04 | ✅ | The website has a clean layout with the room as the centrepiece, a sidebar or overlay for ticket details, real-time status indicators, and smooth transitions. Full end-to-end flow verified with real Azure DevOps data and coding agent activity. |
| S06 | GitHub Copilot Coding Agent Monitor | medium | S02, S04 | ✅ | When a GitHub Copilot coding agent is working on a PR, an avatar appears in the room, animates based on workflow run status, and links to the associated Azure DevOps ticket. |
| S07 | Copilot Agent Activity Monitor Workflow | low | S06 | ✅ | A GitHub Actions workflow watches Copilot agent PR activity and posts status updates as PR comments + syncs ADO work item state (To Do → Doing → Done) automatically. No human watching required. |
| S08 | Copilot Agent Rich Activity Display | low | S06 | ✅ | The Copilot agent avatar speech bubble on localhost:3000 shows detailed activity — commit messages, phase (coding/responding/planning), and progress — instead of a generic "Working..." message. |
| S09 | Live Session Activity in Speech Bubbles | medium | S06 | ✅ | Copilot agent speech bubbles show live file, test, search, and edit activity from the Copilot sessions API instead of generic commit summaries. |
| S10 | Real-Time SSE Streaming for Copilot Agent Activity | low | S09 | ✅ | Copilot agent speech bubbles update within ~2s of agent activity via persistent SSE connections to the Copilot sessions API, instead of polling every 15s. |
| S11 | Fix Copilot Agent Streaming Fallback & ADO PR-Opened State Sync | medium | S10, S07 | ✅ | Copilot agent speech bubbles update in real time (not 15s stale polls) with visible feed mode indicators, and opening a Copilot PR reliably moves the linked ADO ticket to "Doing" via server-side sync. |
| S12 | Floor & Wall Thickness for Habbo-Authentic Room Depth | low | S01 | ✅ | Floor tiles show visible darker side faces (slab depth) and walls have edge thickness strips, giving the room a constructed 3D feel matching the classic Habbo look. |
| S13 | S13 | low | — | ✅ | Opening localhost:3000 shows walls with a cleaner back-corner seam where each half matches its adjacent wall color. |
