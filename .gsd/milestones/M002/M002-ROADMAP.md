# M002: Polish & Extended Features

**Vision:** Expand the v1 isometric renderer with a richer furniture catalog, avatar interaction polish, visual refinements, team sections, and orchestration UI.

## Success Criteria

- Data-driven furniture catalog with 16+ new items
- Avatar builder UI with clothing customization
- Agent factory workflow with 4 team sections
- Azure DevOps Boards integration alongside GitHub Projects
- PixelLab character generation replaces copyrighted Habbo avatars

## Slices

- [x] **S01: Furniture Catalog & Rendering Fixes** `risk:medium` `depends:[]`
  > After this: unit tests prove Furniture Catalog & Rendering Fixes works
- [x] **S02: Avatar Polish & Chair Sitting** `risk:medium` `depends:[S01]`
  > After this: unit tests prove Avatar Polish & Chair Sitting works
- [x] **S03: Chair Layer Splitting** `risk:medium` `depends:[S02]`
  > After this: Split chair furniture into separate seat and backrest renderables at different depth values so a sitting avatar sorts between them — seat renders behind the avatar (depth X+Y), backrest renders in front (depth X+Y+0.
- [x] **S04: Room Walls Kanban Notes** `risk:medium` `depends:[S03]`
  > After this: Replace per-tile wall strips with full room-perimeter wall panels that extend to a shared baseline, plus a back corner post where the two walls meet.
- [ ] **S05: Volter Font as Default** `risk:medium` `depends:[S04]`
  > After this: unit tests prove Volter Font as Default works
- [x] **S06: Avatar Builder Ui** `risk:medium` `depends:[S05]`
  > After this: Define the outfit configuration type system, curated clothing catalog, color palettes, and default presets that form the data foundation for the avatar builder.
- [x] **S07: Avatar Facial Features Add Eyes And Mouth To Avatar Head Rendering** `risk:medium` `depends:[S06]`
  > After this: Add eyes and mouth to avatar head rendering by integrating the `hh_human_face` cortex-asset into the existing 11-layer figure composition, making it a 13-layer system.
- [ ] **S08: Performance Optimisation** `risk:medium` `depends:[S07]`
  > After this: unit tests prove Performance Optimisation works
- [x] **S09: Agent Factory Workflow With Team Sections And Orchestration Ui** `risk:medium` `depends:[S08]`
  > After this: Build the agent classification system that maps JSONL transcript data to roles, teams, and display names.
- [x] **S10: Bugfixes And Wishlist** `risk:medium` `depends:[S09]`
  > After this: Constrain In Progress sticky notes to the left wall only, removing the cross-wall overflow to the right wall.
- [x] **S11: Stray Pixel Diagnostic Fix And Right Click Movement** `risk:medium` `depends:[S10]`
  > After this: Diagnose and fix the stray pixel artifact that appears near avatars at direction 2 (facing camera).
- [x] **S12: Fix Walking Animation Clipping And Layer Artifacts** `risk:medium` `depends:[S11]`
  > After this: Fix two walking animation bugs in the avatar renderer: (1) chest/shirt sprite not tracking body walk-frame bounce, causing skin pixels to bleed through clothing, and (2) potential doubled-hand artifact in flipped directions due to hand/sleeve offset misalignment.
- [x] **S13: Fix Move Logic To Respect Selected Avatar** `risk:medium` `depends:[S12]`
  > After this: Wire the existing AvatarSelectionManager.
- [x] **S14: Fix Agent Discovery Pipeline Deduplicate Spawns Filter Parent Conversations Classify Sub Agents Properly** `risk:medium` `depends:[S13]`
  > After this: Fix three bugs in the agent discovery pipeline: (1) filter out root-level parent conversation JSONL files so only subagent files spawn avatars, (2) read companion meta.
- [x] **S15: Auto Despawn Agents On Task Completion** `risk:medium` `depends:[S14]`
  > After this: Add auto-despawn for sub-agents that have completed their tasks, detected by reading the last JSONL line for `stop_reason: "end_turn"` combined with a file staleness check (15 seconds since last modification).
- [x] **S16: Azure Devops Boards Integration** `risk:medium` `depends:[S15]`
  > After this: Create the Azure DevOps Boards data-fetching module with TDD — async function that calls WIQL + workitemsbatch REST API endpoints, maps work item states to kanban statuses, and returns KanbanCard[].
- [x] **S17: Pixellab Character Integration** `risk:medium` `depends:[S16]`
  > After this: unit tests prove pixellab-character-integration works
- [ ] **S18: Remove Copyrighted Habbo Characters** `risk:medium` `depends:[S17]`
  > After this: Generate 4 team-specific PixelLab characters and wire per-team atlas selection into the renderer.
- [ ] **S19: Architecture Documentation Lite Code Linked Diagrams Of Current Codebase State For Human Review** `risk:medium` `depends:[S18]`
  > After this: Create a top-level ARCHITECTURE.
- [ ] **S20: Architecture Refactor Full Deep Codebase Restructuring With Comprehensive Architecture Docs And Code Linked Diagrams** `risk:medium` `depends:[S19]`
  > After this: unit tests prove architecture-refactor-full-deep-codebase-restructuring-with-comprehensive-architecture-docs-and-code-linked-diagrams works
