# T01: 17.6-azure-devops-boards-integration 01

**Slice:** S16 — **Milestone:** M002

## Description

Create the Azure DevOps Boards data-fetching module with TDD — async function that calls WIQL + workitemsbatch REST API endpoints, maps work item states to kanban statuses, and returns KanbanCard[].

Purpose: Provide the data source adapter for Azure DevOps work items, mirroring the existing githubProjects.ts pattern with silent-fallback error handling.
Output: Tested `src/azureDevOpsBoards.ts` module + comprehensive test suite.

## Must-Haves

- [ ] "fetchAzureDevOpsCards returns KanbanCard[] with correct title and status from Azure DevOps REST API"
- [ ] "Azure DevOps work item states are mapped to kanban statuses (Todo, In Progress, Done)"
- [ ] "Any error (network, auth, empty config) returns [] silently"
- [ ] "Work item IDs are capped at 100 before the batch call"

## Files

- `src/azureDevOpsBoards.ts`
- `tests/azureDevOpsBoards.test.ts`
