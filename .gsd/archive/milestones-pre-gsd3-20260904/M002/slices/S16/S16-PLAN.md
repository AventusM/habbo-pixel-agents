# S16: Azure Devops Boards Integration

**Goal:** Create the Azure DevOps Boards data-fetching module with TDD — async function that calls WIQL + workitemsbatch REST API endpoints, maps work item states to kanban statuses, and returns KanbanCard[].
**Demo:** Create the Azure DevOps Boards data-fetching module with TDD — async function that calls WIQL + workitemsbatch REST API endpoints, maps work item states to kanban statuses, and returns KanbanCard[].

## Must-Haves


## Tasks

- [x] **T01: 17.6-azure-devops-boards-integration 01** `est:3min`
  - Create the Azure DevOps Boards data-fetching module with TDD — async function that calls WIQL + workitemsbatch REST API endpoints, maps work item states to kanban statuses, and returns KanbanCard[].

Purpose: Provide the data source adapter for Azure DevOps work items, mirroring the existing githubProjects.ts pattern with silent-fallback error handling.
Output: Tested `src/azureDevOpsBoards.ts` module + comprehensive test suite.
- [x] **T02: 17.6-azure-devops-boards-integration 02** `est:2min`
  - Wire Azure DevOps fetch into the VS Code extension: add settings contributions to package.json, add a kanbanSource selector setting, and update extension.ts to read Azure DevOps config and poll with async fetch.

Purpose: Make Azure DevOps work items appear as sticky notes on the room walls, using the same kanbanCards message path already consumed by the webview renderer.
Output: Working end-to-end integration from VS Code settings → Azure DevOps REST API → webview kanban sticky notes.

## Files Likely Touched

- `src/azureDevOpsBoards.ts`
- `tests/azureDevOpsBoards.test.ts`
- `package.json`
- `src/extension.ts`
