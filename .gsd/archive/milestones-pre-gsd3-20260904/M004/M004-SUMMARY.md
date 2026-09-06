---
id: M004
provides:
  - Standalone Habbo room website with live Azure DevOps and Copilot agent visibility
key_decisions:
  - Reuse the existing room renderer and extensionMessage protocol across VS Code and standalone web surfaces
  - Keep Azure DevOps and GitHub/Copilot integrations in a local Node server so secrets stay out of browser code
  - Use the Copilot sessions API for fine-grained activity, with explicit SSE and fallback feed modes instead of generic commit summaries
patterns_established:
  - Browser and webview surfaces can consume the same extensionMessage stream
  - Static room geometry uses wall-panels-before-floors and wall-ledges-after-floors two-pass rendering
observability_surfaces:
  - scripts/web-server.mjs console logs for WS, Kanban, Copilot monitor, feed mode, and ADO sync
  - Browser status bar and per-agent feed-mode indicators at http://localhost:3000
requirement_outcomes: []
duration: 2026-03-21 → 2026-03-23
verification_result: passed
completed_at: 2026-03-23
---

# M004: Azure DevOps Board → Habbo Room Website

**A standalone Habbo room website now mirrors Azure DevOps ticket state and Copilot or Claude coding-agent activity without breaking the original VS Code extension.**

## What Happened

M004 started by extracting the existing room renderer out of the VS Code webview and proving it could run as a standalone browser surface with the same Canvas 2D modules and event protocol. From there, the milestone added a local HTTP and WebSocket server so real agent events could flow into the browser without duplicating the extension’s renderer logic.

Once the standalone surface existed, the milestone deepened the room’s data model and visuals in layers that still produced live demos at each step: enriched Azure DevOps work items with children and linked PRs, visual linking between agents and tickets, and a more legible website shell with connection state and demo indicators.

The second half of the milestone focused on Copilot visibility. It added a GitHub-backed Copilot monitor, then evolved speech bubbles from generic commit summaries to richer phase and commit text, then to live sessions-API activity, then to low-latency SSE streaming with explicit fast-poll and poll fallbacks. That work also added feed-mode indicators in the browser and server-side Azure DevOps state sync when Copilot opens a PR.

The final slice brought the room visuals closer to classic Habbo depth by adding floor slab faces and visible wall ledges. That left the milestone with a room that not only carries the live ticket and agent data, but also reads more like a constructed space than a flat board.

## Cross-Slice Verification

- `node esbuild.config.mjs && node esbuild.config.mjs web` passed on 2026-03-23, proving both the VS Code extension bundle and the standalone web bundle still build
- `npx vitest run` passed 442/442 on 2026-03-23
- `http://localhost:3000` loaded successfully on 2026-03-23 and showed the live room with connection state, Copilot feed-mode indicator, Azure DevOps polling, and the S12 floor and wall depth changes
- Server runtime logs during local verification showed WebSocket startup, Kanban polling, Copilot monitor startup, PR session resolution, and feed-mode reporting

## Requirement Changes

- None recorded in `REQUIREMENTS.md` — M004 shipped new website capabilities without migrating them into formal requirement IDs, so the roadmap and slice summaries remain the authoritative proof trail for this milestone

## Forward Intelligence

### What the next milestone should know
- The website path is now real and complete; future work can treat `scripts/web-server.mjs` + `src/web/main.tsx` as a supported surface rather than a side demo
- `REQUIREMENTS.md` still needs a dedicated contract pass if future web milestones need formal capability IDs instead of milestone-level tracking

### What's fragile
- `src/web/copilotMonitor.ts` is the highest-churn module in the codebase — it mixes PR polling, workflow status, sessions API integration, feed-mode fallback, and ADO sync
- Live Azure DevOps proof still depends on valid runtime credentials, so auth failures show up as runtime logs rather than compile-time failures

### Authoritative diagnostics
- `scripts/web-server.mjs` console output — the fastest place to confirm WS health, Kanban polling, Copilot monitor lifecycle, feed mode, and ADO sync outcomes
- Browser status bar at `http://localhost:3000` — the quickest user-visible signal for connection health and per-agent feed mode

### What assumptions changed
- The earlier M004 summary assumed the milestone ended at website polish; in practice the meaningful end-to-end milestone required Copilot monitoring, low-latency live activity, feed-mode visibility, ADO sync on PR-opened, and final room depth work before it was actually complete

## Files Created/Modified

- `src/web/main.tsx` — standalone browser entry point and browser-side status/feed-mode handling
- `src/web/wsClient.ts` — WebSocket client bridge into the shared `extensionMessage` protocol
- `src/web/server.ts` — local web server orchestration for agent events, Kanban polling, and Copilot monitor wiring
- `scripts/web-server.mjs` — runtime server entrypoint for the standalone website
- `src/web/copilotMonitor.ts` — Copilot PR, workflow, sessions API, SSE, feed-mode, and ADO sync logic
- `src/azureDevOpsBoards.ts` — enriched Azure DevOps work-item fetching and relations support
- `src/isoKanbanRenderer.ts` — richer sticky notes and linked-ticket rendering
- `src/isoWallRenderer.ts` — visible wall ledges and ceiling-line depth geometry
- `src/isoTileRenderer.ts` — front slab faces for floor depth
- `src/isometricMath.ts` — shared floor thickness constant used by room geometry
