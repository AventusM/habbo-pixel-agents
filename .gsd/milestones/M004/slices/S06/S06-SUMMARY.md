---
status: complete
started: 2026-03-21
completed: 2026-03-21
---

# S06 Summary: GitHub Copilot Coding Agent Monitor

## What Was Done

Added a GitHub Copilot coding agent monitor that polls the GitHub API for Copilot-authored PRs and workflow runs, spawning avatars in the room for each active agent session.

### Files Created
- `src/web/copilotMonitor.ts` — CopilotAgentMonitor class that polls GitHub REST API for:
  - Open PRs authored by "Copilot" or with `copilot/*` branch prefix
  - GitHub Actions workflow runs on copilot branches
  - Emits agentCreated/Status/Tool/Removed/LinkedTicket events via the standard ExtensionMessage protocol
  - Auto-links to Azure DevOps tickets via AB#123 pattern in PR titles
  - Converts branch names to display-friendly names

### Files Modified
- `src/web/server.ts` — Added createCopilotMonitor factory and readGitHubEnv config reader
- `scripts/web-server.mjs` — Starts CopilotAgentMonitor alongside AgentManager, syncs sessions to new WS clients
- `.env` — Added GITHUB_REPO and GITHUB_TOKEN config

### Key Design Decisions
- **Same protocol**: Uses identical ExtensionMessage events as the JSONL-based AgentManager — RoomCanvas works unchanged
- **Status from workflow runs**: Agent is "active" when a workflow run on its copilot branch is in_progress, "idle" otherwise
- **Poll interval 15s**: Frequent enough for responsive UI, within GitHub API rate limits
- **Auto-link via AB#**: PR titles containing AB#123 auto-link the avatar to that Azure DevOps ticket

## Verification Results
- Server logs: `[CopilotMonitor] New agent: Add Desk Chair Combi (PR #11, idle)`
- Avatar visible in room for real PR #11 from the repo
- Orchestration overlay shows agent under Core Dev
- `npm run build` and `npm run build:web` succeed
- `npx vitest run` → 373 tests pass, zero regressions

## What This Proves
GitHub Copilot coding agent activity is visible in real-time in the Habbo room — avatars spawn for open Copilot PRs, reflect workflow run status, and can link to Azure DevOps tickets.
