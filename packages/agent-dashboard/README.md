# @anthropic-claude/agent-dashboard

Real-time web dashboard for GitHub Copilot coding agents.

## Quick Start

```bash
# From the monorepo root:
npm run build:dashboard

# Run the dashboard for any repo:
GITHUB_TOKEN=ghp_xxx node packages/agent-dashboard/bin/agent-dashboard.mjs owner/repo

# Or with flags:
node packages/agent-dashboard/bin/agent-dashboard.mjs --repo owner/repo --token ghp_xxx --port 3000
```

## What It Shows

- Active Copilot coding agent sessions (PRs, workflow status)
- Real-time activity via SSE streaming or fallback polling
- Azure DevOps ticket integration (optional)
- Local agent monitoring via JSONL file watching

## CLI Options

```
agent-dashboard [owner/repo]

Options:
  --repo <owner/repo>    GitHub repository to monitor
  --token <token>        GitHub PAT (or set GITHUB_TOKEN env var)
  --port <number>        Server port (default: 3000)
  --project <path>       Project directory for local JSONL agent watching
  -h, --help             Show help
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token |
| `GITHUB_REPO` | No | `owner/repo` (alternative to CLI arg) |
| `PORT` | No | Server port (default: 3000) |
| `GITHUB_POLL_INTERVAL` | No | Poll interval in seconds (default: 15) |
| `AZDO_ORG` | No | Azure DevOps organization |
| `AZDO_PROJECT` | No | Azure DevOps project |
| `AZDO_PAT` | No | Azure DevOps PAT |

## Package Exports

### Server-side (`@anthropic-claude/agent-dashboard`)

- `AgentManager` — local JSONL agent watcher
- `CopilotAgentMonitor` — GitHub Copilot polling + SSE
- `fetchAzureDevOpsCards` — Azure DevOps board polling
- `createAgentManager`, `createCopilotMonitor` — factory functions
- `readGitHubEnv`, `readAzureDevOpsEnv` — config readers
- Event types: `ExtensionMessage`, `AgentState`, `KanbanCard`, etc.

### Browser-side (`@anthropic-claude/agent-dashboard/client`)

- `connectWs`, `disconnectWs` — WebSocket connection management
- `hasRealAgents`, `getWsState`, `onWsStateChange` — state queries

## Architecture

The package extracts the monitoring core from the [habbo-pixel-agents](https://github.com/AventusM/habbo-pixel-agents) project. It provides:

1. **Event protocol** — `ExtensionMessage` type covering agent lifecycle, status, tool use, tickets
2. **Data sources** — local JSONL, GitHub API, Azure DevOps API, Copilot sessions API
3. **Transport** — HTTP server + WebSocket relay for real-time browser updates
4. **Dashboard** — minimal dark-themed agent card UI (no dependencies)
