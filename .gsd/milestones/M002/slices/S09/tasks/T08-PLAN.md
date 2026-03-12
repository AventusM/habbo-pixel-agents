# T08: 16-agent-factory-workflow 08

**Slice:** S09 — **Milestone:** M002

## Description

Create the orchestration sidebar panel in VS Code's Activity Bar with agent list, section overview, activity log, and quick actions.

Purpose: The sidebar is the command center for monitoring agents across sections. It provides visibility without the room canvas needing to show everything.
Output: WebviewViewProvider sidebar panel with Habbo-themed pixel aesthetic, message bridge for room-sidebar communication.

## Must-Haves

- [ ] "Orchestration panel appears in VS Code Activity Bar sidebar"
- [ ] "Panel shows agent list grouped by section with status indicators"
- [ ] "Section overview shows agent count and activity summary"
- [ ] "Section jump buttons send camera navigation messages to room webview"
- [ ] "Activity log shows scrolling feed of agent events"
- [ ] "Quick actions include reassign, jump to section, and view transcript per agent"

## Files

- `src/orchestrationPanel.ts`
- `src/orchestrationPanelHtml.ts`
- `src/messageBridge.ts`
- `src/extension.ts`
- `package.json`
- `tests/messageBridge.test.ts`
