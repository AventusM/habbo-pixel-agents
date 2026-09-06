# T02: 17.6-azure-devops-boards-integration 02

**Slice:** S16 — **Milestone:** M002

## Description

Wire Azure DevOps fetch into the VS Code extension: add settings contributions to package.json, add a kanbanSource selector setting, and update extension.ts to read Azure DevOps config and poll with async fetch.

Purpose: Make Azure DevOps work items appear as sticky notes on the room walls, using the same kanbanCards message path already consumed by the webview renderer.
Output: Working end-to-end integration from VS Code settings → Azure DevOps REST API → webview kanban sticky notes.

## Must-Haves

- [ ] "VS Code settings for Azure DevOps org/project/PAT/poll interval are registered and readable"
- [ ] "Azure DevOps kanban polling sends KanbanCard[] to webview on the same kanbanCards message type"
- [ ] "Only one kanban source is polled based on the kanbanSource setting"
- [ ] "Extension continues to work when Azure DevOps settings are empty (backward compatible)"

## Files

- `package.json`
- `src/extension.ts`
