# M004: Azure DevOps Board → Habbo Room Website

## What This Is

A standalone website that renders the Habbo isometric room visualisation — currently locked inside a VS Code webview — as a live dashboard showing Azure DevOps ticket progress through animated agents and visual state.

## Goals

1. **Standalone web deployment** — extract the Canvas 2D renderer from the VS Code extension into a self-contained website (static or with a lightweight backend) accessible via browser
2. **Azure DevOps deep integration** — go beyond current kanban cards (title + status) to show ticket hierarchy: sub-tasks, linked items, assignment, and state transitions
3. **GitHub Coding Agent visibility** — when a GitHub Copilot coding agent picks up a ticket, its work (commits, PR progress, sub-agent activity) should be visually represented by an avatar in the room
4. **Ticket lifecycle visualisation** — tickets move through todo → doing → done with visual representation: wall sticky notes, agent activity at desks, completion animations

## What Already Exists

- `src/azureDevOpsBoards.ts` — fetches work items via WIQL + workitemsbatch REST API, maps states to kanban columns
- `src/githubProjects.ts` — fetches GitHub Projects v2 cards via gh CLI GraphQL
- `src/isoKanbanRenderer.ts` — renders kanban cards as isometric sticky notes on room walls (todo/done aggregates, in-progress individual notes)
- Full isometric room renderer with avatars, furniture, sections, camera, animations — all Canvas 2D in a VS Code webview
- Agent monitoring via JSONL transcript file watching (VS Code extension host)

## Key Challenges

- **VS Code decoupling**: The renderer currently depends on VS Code webview messaging (`postMessage`/`onMessage`). Need an alternative data transport for standalone mode (WebSocket, polling, SSE).
- **Agent data source**: JSONL file watching only works on the local filesystem via the VS Code extension host. Standalone website needs a different data feed — probably a lightweight local server that watches JSONL files and pushes events.
- **Azure DevOps depth**: Current integration only fetches top-level work items. Need to expand to fetch child work items, linked PRs, and assignment data.
- **GitHub Coding Agent mapping**: Need to correlate a GitHub coding agent's activity (commits on a branch, PR state) with the Azure DevOps ticket it's working on.

## Constraints

- Must not break the existing VS Code extension — the website is an additional surface, not a replacement
- Canvas 2D rendering code should be shared (not duplicated) between extension and website
- PAT/auth tokens must not be exposed in the browser — any Azure DevOps or GitHub API calls that need auth should go through a local backend
- Keep it simple: local-first, no cloud deployment required for v1 of the website
