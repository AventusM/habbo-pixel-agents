# Project

## What This Is

A local-first Habbo-style agent visualisation system with two working surfaces: a VS Code extension and a standalone website at `http://localhost:3000`. Both surfaces use the same isometric room renderer to show coding agents as avatars, Azure DevOps tickets as wall notes, and related project activity in real time.

## Core Value

Agent and ticket activity should be understandable at a glance in an authentic Habbo room without breaking the original VS Code workflow.

## Current State

- The VS Code extension renders the Habbo room inside a webview, keeps the original JSONL-based agent monitoring flow, and now includes a **"Habbo: Configure Integration"** command (Command Palette) that guides contributors through all env vars via a QuickPick/InputBox wizard.
- The standalone website is fully wired through a local Node server (`scripts/web-server.mjs`) and browser client (`src/web/main.tsx` + `src/web/wsClient.ts`).
- A **CLI configuration wizard** (`scripts/configure.mjs` / `npm run configure`) walks contributors through KANBAN_SOURCE → source-specific credentials → PORT and writes `.env` — with `--dry-run` and `--yes` flags for CI use.
- Website capabilities include:
  - shared room, furniture, and avatar rendering
  - WebSocket relay for live agent events
  - Azure DevOps ticket polling with enriched child-item and linked-PR data
  - agent ↔ ticket linking in the room and orchestration overlay
  - GitHub Copilot PR/workflow monitoring
  - live Copilot speech bubble activity from the sessions API with `sse` / `fast-poll` / `poll` feed modes
  - server-side Azure DevOps "Doing" sync on new Copilot PRs
  - floor slab depth and wall ledge thickness for stronger Habbo-style room depth

## Architecture / Key Patterns

- Shared Canvas 2D renderer: the extension webview and standalone website consume the same room rendering modules.
- Shared event protocol: the standalone browser consumes `extensionMessage` events, which keeps `RoomCanvas` reuse straightforward.
- Local server owns secrets and live integrations: Azure DevOps auth, GitHub/Copilot polling, and WebSocket fanout stay server-side so tokens never enter browser code.
- `.env` management: `src/envConfig.ts` provides `readEnvFile` / `writeEnvFile` helpers shared by the VS Code command and available for future scripts. The CLI wizard (`scripts/configure.mjs`) uses equivalent logic in plain JS.
- Room geometry is pre-rendered for static surfaces; wall panels render before floors, while visible wall ledges render after the floor pass.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M001: Habbo isometric renderer foundation
- [x] M002: Polish & extended features
- [x] M003: PixelLab furniture replacement
- [x] M004: Azure DevOps Board → Habbo Room Website
- [x] M005: Extract private `agent-dashboard` package
- [x] M006: Visual polish & room rendering fixes
- [x] M007: PixelLab character import
- [x] M008: Env var configuration wizard — CLI (`npm run configure`) + VS Code command ("Habbo: Configure Integration")
