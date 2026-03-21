---
status: complete
started: 2026-03-21
completed: 2026-03-21
---

# S03 Summary: Azure DevOps Deep Ticket Integration

## What Was Done

Extended the Azure DevOps integration to fetch enriched work item data (sub-tasks, linked PRs, assignees, work item types) and render them in the expanded sticky note view.

### Data Model Changes
- `KanbanCard` extended with optional `workItemType`, `assignee`, `children`, `linkedPrs` fields
- New types: `KanbanCardChild` (id, title, state, completed) and `KanbanCardPr` (id, title, status, url)

### API Changes
- `fetchAzureDevOpsCards` now requests `System.WorkItemType` and `System.AssignedTo` fields
- New `fetchWorkItemRelations` function fetches child work items via hierarchy links and linked PRs via artifact links
- Optional `includeRelations` flag limits relation fetching to in-progress items (API call budget)

### Rendering Changes
- Expanded note view now shows work item type badge (color-coded), assignee, sub-task list with progress bar and checkmarks, and linked PR list with status dots
- Dynamic panel height based on content
- `workItemTypeColor` helper maps types to colors (User Story=blue, Bug=red, Task=purple, etc.)

### Server Integration
- Web server reads `AZDO_ORG`, `AZDO_PROJECT`, `AZDO_PAT` env vars
- Polls Azure DevOps on configurable interval (`AZDO_POLL_INTERVAL`, default 60s)
- Broadcasts enriched kanban cards to all connected browsers

### Demo Mode
- Demo kanban cards now include enriched data: work item types, assignees, sub-tasks with completion status, linked PRs

## Verification Results
- `npx vitest run` → 373 tests pass, zero regressions
- `npm run build` and `npm run build:web` both succeed
- Visual verification: expanded TODO note shows card list, demo mode renders enriched sticky notes

## Risk Retired
**Azure DevOps hierarchy depth** — sub-tasks and linked PRs are fetched via the relations API and rendered in the expanded note view.
