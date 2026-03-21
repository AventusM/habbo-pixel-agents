# S05: Website Polish & Integrated Experience

**Goal:** The website has a clean layout with the room as the centrepiece, a connection status indicator, improved demo experience, and smooth integration of all S01-S04 features.
**Demo:** Open localhost:3000 — see a polished page with WebSocket connection indicator, room with demo agents linked to tickets, enriched sticky notes, and a clean overall experience.

## Must-Haves

- Connection status indicator (WebSocket connected/disconnected/reconnecting)
- Improved page title and favicon
- Demo mode clearly labeled when active (vs. live mode)
- All S01-S04 features working together seamlessly
- End-to-end verification with real Azure DevOps data (if configured)

## Proof Level

- This slice proves: final-assembly
- Real runtime required: yes
- Human/UAT required: yes

## Verification

- `npm run build:web` succeeds
- `npm run web` starts cleanly with status logs
- Browser shows connection indicator and demo label
- `npm run build` and `npx vitest run` pass
- End-to-end: room renders with agents, kanban, linking

## Tasks

- [ ] **T01: Connection status and demo label overlay** `est:30m`
  - Why: Users need to know if they're seeing live or demo data, and connection health
  - Files: `src/web/main.tsx`, `src/web/wsClient.ts`, `src/web/index.html`
  - Do: Add a small status bar at the bottom of the page showing WS connection state and "DEMO MODE" label. Update page title and add a simple favicon.
  - Verify: Visual — status bar visible, connection state accurate
  - Done when: Status bar shows connected/demo state clearly

## Files Likely Touched

- `src/web/main.tsx`
- `src/web/index.html`
