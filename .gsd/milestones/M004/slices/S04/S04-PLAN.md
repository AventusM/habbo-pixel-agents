# S04: Coding Agent ↔ Ticket Linking

**Goal:** When a GitHub coding agent works on a ticket, its avatar in the room is visually linked to that ticket's sticky note — a highlight connects them, and the ticket note shows "agent working" state.
**Demo:** In demo mode, agent Alice is linked to ticket "Implement room renderer". Her sticky note glows and shows an "AGENT WORKING" badge. In the orchestration overlay, her entry shows the linked ticket.

## Must-Haves

- Agent-to-ticket correlation logic (matching agent task description to ticket title)
- Visual "agent working" indicator on linked sticky notes (glow or badge)
- Orchestration overlay shows linked ticket title for each agent
- Demo mode demonstrates the linking

## Proof Level

- This slice proves: integration (agent ↔ ticket visual link)
- Real runtime required: yes
- Human/UAT required: yes (visual)

## Verification

- `npm run build:web` succeeds
- Demo mode shows agent-ticket linking in the room
- `npx vitest run` passes

## Tasks

- [ ] **T01: Agent-ticket correlation and visual link** `est:1h`
  - Why: Need to map agents to tickets and show the connection visually
  - Files: `src/web/demoData.ts`, `src/isoKanbanRenderer.ts`, `src/agentTypes.ts`, `src/isoOrchestrationOverlay.ts`
  - Do: Add `linkedTicketId` to agent state. In demo mode, set linkedTicketId for demo agents. In kanban renderer, highlight notes whose card.id matches an active agent's linkedTicketId. In orchestration overlay, show linked ticket title next to agent name. Add a "WORKING" badge on linked sticky notes.
  - Verify: Visual inspection — linked sticky note has distinct appearance, overlay shows ticket
  - Done when: Agent-ticket link is visually clear in the room

## Files Likely Touched

- `src/agentTypes.ts`
- `src/web/demoData.ts`
- `src/isoKanbanRenderer.ts`
- `src/isoOrchestrationOverlay.ts`
- `src/RoomCanvas.tsx`
