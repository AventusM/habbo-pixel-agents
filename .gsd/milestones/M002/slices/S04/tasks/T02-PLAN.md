# T02: 12-room-walls-kanban-notes 02

**Slice:** S04 — **Milestone:** M002

## Description

Add GitHub Projects v2 integration to the extension host: fetch kanban cards via `gh api graphql`, send them to the webview via postMessage, and expose settings for configuring which project to sync.

Purpose: This provides the data pipeline for wall-mounted sticky notes. The extension host handles all GitHub API interaction; the webview only receives card data.

Output: `src/githubProjects.ts` with fetch logic, updated `agentTypes.ts` with message types, updated `extension.ts` with polling, updated `package.json` with settings schema, unit tests.

## Must-Haves

- [ ] "Extension host fetches GitHub Projects cards via gh CLI when settings are configured"
- [ ] "Kanban cards are sent to webview via postMessage as KanbanCard[] array"
- [ ] "Polling interval refreshes cards automatically and cleans up on panel dispose"
- [ ] "Missing or unauthenticated gh CLI degrades silently (empty cards array)"
- [ ] "VS Code settings UI exposes org, project number, owner type, and poll interval"

## Files

- `src/agentTypes.ts`
- `src/githubProjects.ts`
- `src/extension.ts`
- `package.json`
- `tests/githubProjects.test.ts`
