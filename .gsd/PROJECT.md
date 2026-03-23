# Project

## What This Is

A local-first Habbo-style agent visualisation system with two working surfaces: a VS Code extension and a standalone website at `http://localhost:3000`. Both surfaces use the same isometric room renderer to show coding agents as avatars, Azure DevOps tickets as wall notes, and related project activity in real time.

## Core Value

Agent and ticket activity should be understandable at a glance in an authentic Habbo room without breaking the original VS Code workflow.

## Current State

- The VS Code extension still renders the Habbo room inside a webview and keeps the original JSONL-based agent monitoring flow.
- The standalone website is fully wired through a local Node server (`scripts/web-server.mjs`) and browser client (`src/web/main.tsx` + `src/web/wsClient.ts`).
- Website capabilities now include:
  - shared room, furniture, and avatar rendering
  - WebSocket relay for live agent events
  - Azure DevOps ticket polling with enriched child-item and linked-PR data
  - agent ↔ ticket linking in the room and orchestration overlay
  - GitHub Copilot PR/workflow monitoring
  - live Copilot speech bubble activity from the sessions API with `sse` / `fast-poll` / `poll` feed modes
  - server-side Azure DevOps "Doing" sync on new Copilot PRs
  - floor slab depth and wall ledge thickness for stronger Habbo-style room depth
- `REQUIREMENTS.md` still reflects the legacy renderer contract more than the website contract; the M004 milestone artifacts are the current authoritative proof trail for the web work.

## Architecture / Key Patterns

- Shared Canvas 2D renderer: the extension webview and standalone website consume the same room rendering modules instead of maintaining separate renderers.
- Shared event protocol: the standalone browser still consumes `extensionMessage` events, which keeps `RoomCanvas` reuse straightforward.
- Local server owns secrets and live integrations: Azure DevOps auth, GitHub/Copilot polling, and WebSocket fanout stay server-side so tokens never enter browser code.
- Room geometry is pre-rendered for static surfaces; wall panels render before floors, while visible wall ledges render after the floor pass so thickness remains visible.
- Copilot activity combines multiple signals: PR/workflow polling for lifecycle, sessions API streaming or fallback polling for fine-grained activity, and explicit feed-mode diagnostics surfaced in both server logs and the browser status bar.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M001: Habbo isometric renderer foundation — replace the flat pixel-agents room with a faithful Habbo-style room, furniture, avatars, and audio
- [x] M002: Polish & extended features — expand room interactions, layouts, builder/editor, orchestration, and overall fit-and-finish
- [x] M003: PixelLab furniture replacement — swap selected furniture sprites with PixelLab-generated assets and keep the build pipeline working
- [x] M004: Azure DevOps Board → Habbo Room Website — ship a standalone web dashboard with Azure DevOps tickets, Copilot activity, live speech bubbles, and the shared Habbo room renderer
