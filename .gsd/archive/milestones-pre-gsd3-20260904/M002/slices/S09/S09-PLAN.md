# S09: Agent Factory Workflow With Team Sections And Orchestration Ui

**Goal:** Build the agent classification system that maps JSONL transcript data to roles, teams, and display names.
**Demo:** Build the agent classification system that maps JSONL transcript data to roles, teams, and display names.

## Must-Haves


## Tasks

- [x] **T01: 16-agent-factory-workflow 01** `est:3min`
  - Build the agent classification system that maps JSONL transcript data to roles, teams, and display names.

Purpose: Foundation for all role-based features (outfits, section assignment, idle behaviors, sidebar grouping). Without classification, agents have no identity beyond "Claude N".
Output: `agentClassifier.ts` with classification pipeline, extended `agentTypes.ts`, and comprehensive tests.
- [x] **T02: 16-agent-factory-workflow 02** `est:2min`
  - Build the room layout engine that generates 2x2 section grid templates with visual dividers and doorways.

Purpose: The multi-section floor is the spatial foundation for team zones. Without it, agents have no sections to be assigned to.
Output: `roomLayoutEngine.ts` with template generation for 3 sizes, and tests.
- [x] **T03: 16-agent-factory-workflow 03** `est:4min`
  - Add click-drag panning and scroll-wheel zoom to the room canvas so users can navigate a large multi-section floor.

Purpose: The 2x2 section floor is too large to fit in a single viewport. Camera navigation is essential for Phase 16's multi-section layout.
Output: `cameraController.ts` with pan/zoom math, RoomCanvas integration, and tests.
- [x] **T04: 16-agent-factory-workflow 04** `est:2min`
  - Expand the furniture catalog with section-themed items and implement the teleport booth spawn/despawn effect.

Purpose: Sections need distinct themed furniture to feel like team zones. The teleport booth is the spawn/despawn point per user decision.
Output: Extended furniture catalog, teleport flash effect, new cortex-asset downloads, section furniture placement in layout templates.
- [x] **T05: 16-agent-factory-workflow 05** `est:2min`
  - Integrate agent classification into the agent discovery pipeline so agents are automatically classified on spawn and assigned to teams.

Purpose: Connects the classification logic (Plan 01) with the agent lifecycle, so every agent gets a role, team, and display name before the webview renders them.
Output: Updated agentManager.ts with classification step, extended transcript parsing, and webview messaging.
- [x] **T06: 16-agent-factory-workflow 06** `est:3min`
  - Wire the room layout engine, section management, and teleport effects into the live rendering pipeline.

Purpose: This plan brings all Wave 1-2 foundation pieces together: the multi-section floor renders, agents spawn at teleport booths, and sections are functional. Includes the full spawn AND despawn teleport flow per CONTEXT.md decisions.
Output: Working multi-section room with section-aware agent spawning, despawning, and teleport effects.
- [x] **T07: 16-agent-factory-workflow 07** `est:3min`
  - Add role-based outfit presets and role-specific idle behaviors so agents visually match their team and behave appropriately when idle.

Purpose: Visual and behavioral differentiation makes agents recognizable. Planners look and act different from coders.
Output: Role outfit presets in avatarOutfitConfig, role-specific idle behavior in IdleWanderManager.
- [x] **T08: 16-agent-factory-workflow 08** `est:4min`
  - Create the orchestration sidebar panel in VS Code's Activity Bar with agent list, section overview, activity log, and quick actions.

Purpose: The sidebar is the command center for monitoring agents across sections. It provides visibility without the room canvas needing to show everything.
Output: WebviewViewProvider sidebar panel with Habbo-themed pixel aesthetic, message bridge for room-sidebar communication.
- [x] **T09: 16-agent-factory-workflow 09** `est:6min`
  - Final integration: agent popup cards, activity-linked furniture states, Avatar Builder role outfits tab, camera auto-follow, and visual polish checkpoint.

Purpose: Completes the Phase 16 feature set with interactive furniture, in-room agent info, camera automation, and the Role Outfits tab for customizing role-to-outfit mappings (AF-20). Human verification ensures everything looks right.
Output: Full Phase 16 feature set integrated and visually verified.

## Files Likely Touched

- `src/agentClassifier.ts`
- `src/agentTypes.ts`
- `tests/agentClassifier.test.ts`
- `src/roomLayoutEngine.ts`
- `tests/roomLayoutEngine.test.ts`
- `src/cameraController.ts`
- `src/RoomCanvas.tsx`
- `tests/cameraController.test.ts`
- `src/furnitureRegistry.ts`
- `src/teleportEffect.ts`
- `src/roomLayoutEngine.ts`
- `scripts/download-habbo-assets.mjs`
- `tests/teleportEffect.test.ts`
- `src/agentManager.ts`
- `src/transcriptParser.ts`
- `src/agentTypes.ts`
- `src/extension.ts`
- `src/webview.tsx`
- `src/RoomCanvas.tsx`
- `src/avatarManager.ts`
- `src/sectionManager.ts`
- `src/avatarOutfitConfig.ts`
- `src/idleWander.ts`
- `src/RoomCanvas.tsx`
- `src/orchestrationPanel.ts`
- `src/orchestrationPanelHtml.ts`
- `src/messageBridge.ts`
- `src/extension.ts`
- `package.json`
- `tests/messageBridge.test.ts`
- `src/RoomCanvas.tsx`
- `src/isoFurnitureRenderer.ts`
- `src/AvatarBuilderModal.tsx`
