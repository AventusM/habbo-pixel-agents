# S03: Azure DevOps Deep Ticket Integration

**Goal:** The server fetches Azure DevOps work items including sub-tasks, assignees, work item type, and linked PRs. Sticky notes on the room walls show enriched ticket data — clicking expands to show sub-task progress and PR status.
**Demo:** Open the room, see sticky notes with work item type badges. Click a note to see its sub-tasks (with completion checkmarks) and linked PRs.

## Must-Haves

- KanbanCard extended with children, linkedPrs, assignee, workItemType fields
- Azure DevOps fetcher retrieves child work items via relations API
- Azure DevOps fetcher retrieves linked PRs via relations API
- Expanded note view shows sub-tasks with completion status
- Expanded note view shows linked PRs with status
- WebSocket server relays enriched kanban data to browser
- Existing VS Code extension unchanged (backward compatible KanbanCard)

## Proof Level

- This slice proves: integration (enriched Azure DevOps data renders in browser)
- Real runtime required: yes
- Human/UAT required: yes (visual inspection of expanded notes)

## Verification

- `npx vitest run` passes (existing + new Azure DevOps tests)
- `npm run build` and `npm run build:web` succeed
- Expanded note shows sub-tasks and PRs when Azure DevOps data is available
- Fallback: works with no Azure DevOps config (empty cards, demo mode)

## Tasks

- [ ] **T01: Extend KanbanCard type and Azure DevOps fetcher** `est:1h`
  - Why: Need richer data model and API calls for sub-tasks, assignees, and PRs
  - Files: `src/agentTypes.ts`, `src/azureDevOpsBoards.ts`
  - Do: Add optional fields to KanbanCard (children, linkedPrs, assignee, workItemType). Extend fetchAzureDevOpsCards to request additional fields (AssignedTo, WorkItemType) and fetch child relations. Add a separate fetchWorkItemRelations function for PRs and parent/child links.
  - Verify: `npx vitest run` passes with updated/new tests
  - Done when: KanbanCard includes enriched data from Azure DevOps

- [ ] **T02: Render enriched expanded notes** `est:45m`
  - Why: The expanded note view needs to show sub-tasks and PRs
  - Files: `src/isoKanbanRenderer.ts`
  - Do: Update drawExpandedNote to show assignee, work item type badge, sub-task list with checkmarks, and linked PR list with status. Expand panel height dynamically based on content.
  - Verify: Visual inspection in browser — expanded note shows enriched data
  - Done when: Clicking a sticky note shows sub-tasks with completion status and linked PRs

- [ ] **T03: Wire kanban data through WebSocket server** `est:30m`
  - Why: The standalone server needs to fetch and relay Azure DevOps data
  - Files: `src/web/server.ts`, `scripts/web-server.mjs`
  - Do: Add kanban polling to the server — read Azure DevOps config from .env, fetch cards periodically, broadcast kanbanCards messages over WebSocket. Support AZDO_ORG, AZDO_PROJECT, AZDO_PAT env vars.
  - Verify: `npm run web` with Azure DevOps config shows real tickets
  - Done when: Server fetches and relays enriched kanban cards to browser

## Files Likely Touched

- `src/agentTypes.ts`
- `src/azureDevOpsBoards.ts`
- `src/isoKanbanRenderer.ts`
- `src/web/server.ts`
- `scripts/web-server.mjs`
- `tests/azureDevOpsBoards.test.ts`
