# Copilot Agent Activity Monitor

A GitHub Actions workflow that provides automatic visibility into GitHub Copilot coding agent activity — no human watching required.

## What it does

When Copilot opens, closes, or merges a PR:

| Event | PR Comment | ADO Board |
|---|---|---|
| PR opened | 🤖 "Agent monitor — PR opened" | Issue → **Doing** |
| PR reopened | 🔄 "Agent monitor — PR reopened" | Issue → **Doing** |
| PR merged | ✅ "Agent monitor — PR merged" | Issue → **Done** |
| PR closed (no merge) | ❌ "Agent monitor — PR closed" | Issue → **To Do** |

When CI runs on a Copilot agent branch:

| CI Result | PR Comment |
|---|---|
| ✅ Pass | 🟢 "CI passed" with link to run |
| ❌ Fail | 🔴 "CI failed" with link to details |

## How linking works

The workflow reads `AB#NNN` from the PR title or body to identify the linked ADO work item. When Copilot agent is triggered from an ADO board item, it includes this reference automatically.

## The flow

1. Create an Issue on your ADO board
2. Trigger Copilot coding agent from ADO (creates a GitHub PR with `AB#NNN`)
3. Workflow detects the PR → comments on the PR → moves ADO item to **Doing**
4. CI runs → workflow comments pass/fail on the PR
5. PR merged → workflow moves ADO item to **Done**

No GitHub issues involved. Everything happens on the PR and the ADO board.

## Setup

### 1. Add repo secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value |
|---|---|
| `AZURE_DEVOPS_PAT` | Your ADO Personal Access Token (needs `vso.work_write` scope) |
| `AZURE_DEVOPS_ORG` | Your ADO organization name (e.g. `aventusm`) |
| `AZURE_DEVOPS_PROJECT` | Your ADO project name (e.g. `habbo-ado-board`) |

### 2. Workflow is already active

The workflow file (`.github/workflows/copilot-agent-monitor.yml`) triggers automatically on:
- `pull_request` events (opened, closed, reopened) for `copilot/*` branches
- `workflow_run` completions of "Copilot Setup Steps" on `copilot/*` branches

No manual activation needed.

## Copilot agent detection

A PR is treated as a Copilot agent PR if either:
- The branch name starts with `copilot/`
- The PR author is `Copilot`

Non-Copilot PRs are ignored completely (the job's `if` condition skips them).

## ADO work item states

The workflow maps to the Basic process Issue states:
- **To Do** (Proposed)
- **Doing** (InProgress)  
- **Done** (Completed)
