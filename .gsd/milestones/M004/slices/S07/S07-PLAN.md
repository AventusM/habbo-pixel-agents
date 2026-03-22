# S07 Plan: Copilot Agent Activity Monitor Workflow

## Goal

A GitHub Actions workflow that automatically:
1. Comments on GitHub issues when Copilot agent starts/finishes work
2. Syncs ADO work item state (To Do → Doing → Done) based on PR lifecycle
3. Comments with CI failure details when agent PRs fail checks

This closes the visibility gap — ADO board updates and GitHub issue comments happen without anyone watching.

## Tasks

- [x] **T01: Core workflow — PR opened/merged/closed + CI status** `est:45min`
  Created `.github/workflows/copilot-agent-monitor.yml` with two jobs: `pr-lifecycle` (PR events → GitHub issue comments + ADO state sync) and `ci-status` (workflow_run completion → CI result comments). Covers all four PR states and three CI outcomes.

- [x] **T02: CI status notifications** `est:30min`
  Merged into T01 — the `ci-status` job in the same workflow handles `workflow_run` events from "Copilot Setup Steps" on `copilot/*` branches.

- [x] **T03: Verification & docs** `est:15min`
  Validated YAML structure, trigger config, step names, and permissions programmatically. Created `docs/guides/COPILOT-AGENT-MONITOR.md` with setup instructions, linking conventions, and state mapping.
