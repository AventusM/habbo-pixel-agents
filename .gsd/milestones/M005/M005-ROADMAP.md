# M005: Extract Private `agent-dashboard` Package

**Vision:** Any private repo with GitHub coding agents gets a real-time web dashboard by adding one dependency and running one CLI command.

## Success Criteria

- `npx @AventusM/agent-dashboard --repo owner/repo` starts a local server at `localhost:3000` showing live agent activity
- The dashboard shows Copilot agent PRs, workflow status, and live session activity (SSE or fallback polling)
- Azure DevOps ticket integration works when configured via env vars
- This repo's `npm run web` still works, now consuming the extracted package instead of inline copies
- The package is published to GitHub Packages as a private scoped package

## Key Risks / Unknowns

- **Workspace wiring**: npm workspaces + esbuild need to resolve the local package correctly during development — misconfigured paths could break the existing build
- **Server extraction**: `web-server.mjs` is a 305-line script mixing HTTP serving, WebSocket relay, and agent setup — needs to become a configurable entry point without losing the current behavior
- **Frontend skinning**: The Habbo repo needs to swap in its own React frontend while the package ships a generic one — the extension point design matters

## Proof Strategy

- Workspace wiring → retire in S01 by proving the extracted package builds, the existing `npm run web` still works with a workspace link, and esbuild resolves imports
- Server extraction → retire in S02 by proving `npx @AventusM/agent-dashboard --repo owner/repo` starts and connects to GitHub APIs
- Frontend skinning → retire in S03 by proving this repo's Habbo frontend consumes the package's monitoring core with its own rendering

## Verification Classes

- Contract verification: unit tests for event protocol types, copilot monitor parsing, agent classifier
- Integration verification: CLI starts server, connects to GitHub API (mocked or real), relays events over WebSocket to browser
- Operational verification: server lifecycle (startup, graceful shutdown, reconnect), WebSocket client auto-reconnect
- UAT / human verification: browser dashboard shows live agent activity for a configured repo

## Milestone Definition of Done

This milestone is complete only when all are true:

- The `@AventusM/agent-dashboard` package exists in `packages/agent-dashboard/` with its own `package.json`
- `npx @AventusM/agent-dashboard --repo owner/repo` starts a working dashboard
- This repo's `npm run web` works via workspace dependency on the extracted package
- The package is publishable to GitHub Packages (dry-run verified)
- At least one real Copilot agent session is visible in both the generic and Habbo dashboards

## Requirement Coverage

- Covers: new requirements (to be registered during slice planning)
- Leaves for later: public distribution, GitHub App webhooks, agent-emitted protocol

## Slices

- [ ] **S01: Extract monitoring core into workspace package** `risk:high` `depends:[]`
  > After this: `packages/agent-dashboard/` exists with all monitoring modules, builds independently, and the root repo's `npm run web` still works via workspace link

- [ ] **S02: CLI entry point and standalone server** `risk:medium` `depends:[S01]`
  > After this: `npx @AventusM/agent-dashboard --repo owner/repo` starts a server that polls GitHub and relays events over WebSocket — verified with a real or mocked GitHub response

- [ ] **S03: Generic React dashboard frontend** `risk:medium` `depends:[S02]`
  > After this: the package ships a default React dashboard showing agent list, status, activity timeline — viewable at localhost:3000 with no Habbo rendering

- [ ] **S04: Habbo repo consumes extracted package** `risk:low` `depends:[S01,S03]`
  > After this: this repo's `npm run web` uses the extracted monitoring core as a workspace dependency, with its own Habbo frontend skin on top — no duplicated monitoring code

- [ ] **S05: Package publishing and CLI distribution** `risk:low` `depends:[S04]`
  > After this: the package is published to GitHub Packages, installable via `npm install @AventusM/agent-dashboard`, and the CLI works from any private repo that has access

## Boundary Map

### S01 → S02

Produces:
- `packages/agent-dashboard/src/` with all monitoring modules (agentTypes, agentManager, copilotMonitor, azureDevOpsBoards, fileWatcher, transcriptParser, agentClassifier)
- Exported `ExtensionMessage` type as the public event protocol
- Exported `createAgentManager()` and `createCopilotMonitor()` factory functions
- `packages/agent-dashboard/package.json` with name, private:true, exports map

Consumes:
- nothing (first slice)

### S02 → S03

Produces:
- `packages/agent-dashboard/bin/agent-dashboard.mjs` CLI entry point
- Configurable HTTP + WebSocket server (port, static dir, project dir)
- `wsClient.ts` exported for browser consumption

Consumes:
- Monitoring core factories from S01

### S03 → S04

Produces:
- Default React dashboard components (AgentList, AgentCard, ActivityTimeline, StatusBar)
- Default `index.html` + `main.tsx` entry point
- esbuild config that builds the frontend into `dist/dashboard/`

Consumes:
- WebSocket client from S02
- Event protocol types from S01

### S01 + S03 → S04

Consumes:
- Monitoring core (S01) as workspace dependency
- Knowledge of dashboard component structure (S03) to verify the Habbo frontend can replace it

### S04 → S05

Produces:
- `npm publish --registry=https://npm.pkg.github.com` workflow
- `.npmrc` configuration for GitHub Packages auth
- README with installation and usage instructions

Consumes:
- Complete, tested package from S01–S04
