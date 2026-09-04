# S06: GitHub Copilot Coding Agent Monitor

**Goal:** The standalone website polls GitHub for Copilot coding agent activity (PRs, workflow runs) and visualises active agents as avatars in the room, with auto-linking to Azure DevOps tickets.
**Demo:** When a Copilot coding agent is working on a PR in the repo, an avatar spawns in the room, shows "Working..." while the Actions workflow runs, goes idle when waiting for review, and links to the associated Azure DevOps ticket if the PR title contains an AB# reference.

## Must-Haves

- Poll GitHub API for Copilot-authored PRs (user "Copilot" or branch `copilot/*`)
- Poll GitHub Actions workflow runs to detect active agent sessions
- Spawn/despawn avatars based on open Copilot PRs
- Agent status: active when workflow is running, idle when waiting for review
- Auto-link to Azure DevOps tickets via AB#123 pattern in PR title
- Configurable via GITHUB_TOKEN env var (from .env)
- Server relays Copilot agent events over WebSocket to browser

## Proof Level

- This slice proves: integration (GitHub API → WebSocket → browser avatar)
- Real runtime required: yes
- Human/UAT required: yes (verify avatar appears for real Copilot PR)

## Verification

- `npm run build:web` succeeds
- Server logs show Copilot monitor polling and finding PR #11
- Avatar appears in room for the existing Copilot PR
- `npx vitest run` passes (no regressions)

## Tasks

- [x] **T01: Copilot agent monitor module and server wiring** `est:1h`
  - Why: Need a poller that watches GitHub for Copilot agent PRs and workflow runs, emitting agent lifecycle events
  - Files: `src/web/copilotMonitor.ts`, `src/web/server.ts`, `scripts/web-server.mjs`
  - Do: Create CopilotAgentMonitor class that polls GitHub REST API for Copilot PRs and Actions runs. Wire into server.ts exports. Start in web-server.mjs alongside AgentManager. Read GITHUB_TOKEN and GITHUB_REPO from env.
  - Verify: `npm run web` shows Copilot monitor log messages, avatar appears for existing PR #11
  - Done when: Copilot agent avatar spawns in room based on real GitHub data

- [x] **T02: Verify and commit** `est:15m`
  - Why: Ensure no regressions
  - Files: none (verification only)
  - Do: Run builds and tests, verify visually
  - Verify: `npm run build:web`, `npm run build`, `npx vitest run` all pass
  - Done when: All verification passes

## Files Likely Touched

- `src/web/copilotMonitor.ts` (new)
- `src/web/server.ts` (modify — export monitor factory)
- `scripts/web-server.mjs` (modify — start monitor)
