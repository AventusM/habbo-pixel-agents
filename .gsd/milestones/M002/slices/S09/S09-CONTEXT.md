# Phase 16: Agent Factory Workflow with Team Sections and Orchestration UI - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a multi-section open-plan floor with 4 team zones (Planning, Core Dev, Infrastructure, Support), auto-classify agents into roles/sections based on JSONL transcript data and `.claude/` config, add a Habbo-themed orchestration side panel in the VS Code activity bar, and introduce teleport booth spawn/despawn with classic Habbo flash effects. Agents get role-based outfits, role-specific idle behaviors, and names in `<Role> - <Task>` format.

</domain>

<decisions>
## Implementation Decisions

### Agent Creation & Discovery
- Keep auto-discovery from JSONL sessions (no manual factory)
- Classification is automatic: primary signal is `subagent_type` field from Task/Agent tool spawning
- For sessions without `subagent_type`, show a user prompt popup for manual classification — immediate, no delay
- Assignment does NOT persist across VS Code sessions — re-inferred fresh each time
- Different JSONL sessions = different agents (no role updating mid-session)
- User can click to reassign an agent's role/team after auto-classification

### Agent Naming
- Format: `<Role> - <Task>` (e.g., "Executor - Frontend", "Researcher - Auth")
- Role inferred from subagent_type or user popup
- Task area inferred from initial prompt + refined by file path activity (e.g., `src/components/` = Frontend)

### Role Taxonomy
- Roles derived from `.claude/` config: GSD subagent types (gsd-phase-researcher, gsd-planner, gsd-executor, gsd-verifier, gsd-debugger, etc.) AND configured MCP servers/skills/plugins
- All roles must map to one of 4 high-level categories:
  - **Planning**: gsd-phase-researcher, gsd-planner, gsd-plan-checker, architects
  - **Core Dev**: gsd-executor, coders, testers
  - **Infrastructure**: gsd-codebase-mapper, DevOps tools, CI/CD
  - **Support**: gsd-debugger, gsd-verifier, documenters, refactorers
- Role-to-category mapping is predefined but configurable

### Floor Layout
- Single open-plan floor with visual dividers (rugs + thematic furniture + low wall partitions)
- 4 sections arranged in a **2x2 grid** layout
- Sections connected by open doorways (1-2 tile-wide openings in partitions)
- All flat elevation (no height variation between sections)
- No shared/common areas — just the 4 team sections
- 3 preset template sizes: Small (2-3 agents/section), Medium (4-6 agents), Large (8-10 agents)
- Smart default template selection based on project size/config; user can switch in settings

### Teleport Booth
- Classic Habbo teleport cabinet furniture sourced from cortex-assets
- Each section has its own teleport booth as spawn/despawn point
- Agents emerge from the booth on spawn, walk to booth on despawn
- Classic Habbo flash/glow effect on teleport activation

### Section Furniture (Themed)
- **Planning section**: Whiteboards (ties into kanban system), conference table with chairs, bookshelves + Claude's discretion
- **Core Dev section**: Desks with monitors, server rack/terminal, plant/coffee machine + Claude's discretion
- **Infrastructure section**: Claude's discretion (server/ops themed)
- **Support section**: Claude's discretion (diagnostic/debug themed)
- New furniture items expanded from cortex-assets (not limited to existing 25-item catalog)
- Furniture has activity-linked interactive states (monitors glow when agent active, whiteboards fill during planning, lamps on/off for section activity)

### Agent Appearance
- Role-based outfits: new clothing assets from cortex-assets, each role gets a distinct outfit
- Role-based accessories on top of outfit
- Customizable role-to-outfit mapping via extended Avatar Builder UI (new "Role Outfits" tab)
- Role-specific idle behaviors: Coders sit at desks, Planners pace/sit at conference table, Researchers browse bookshelves

### Orchestration Side Panel
- Custom webview panel (not TreeView) in VS Code Activity Bar (left sidebar)
- Habbo-themed pixel aesthetic matching the room view
- Contains all 4 of:
  - **Agent list with status**: grouped by section, showing `<Role> - <Task>`, active/idle, current tool
  - **Section overview**: agent count, activity summary, aggregate stats (files modified, tools run, active time)
  - **Activity log**: human-readable scrolling feed of agent events (e.g., "Coder-Backend read auth.ts")
  - **Quick actions**: reassign agents, jump camera to section, view transcript
- Section list buttons for camera navigation (no minimap)

### In-Room UI
- Clicking an agent shows a brief popup card near them + side panel scrolls to that agent's details
- Existing name tags and speech bubbles continue working with new `<Role> - <Task>` names

### Camera & Navigation
- Click-drag to pan, scroll wheel to zoom
- Default view: full floor overview (all 4 sections visible)
- Auto-follow toggle: when on, camera tracks section with most activity; when off, manual control
- Section jump buttons in side panel only (no room overlay)

### Claude's Discretion
- Infrastructure and Support section furniture choices
- Parent/child agent hierarchy visualization approach
- New clothing asset source (cortex-assets vs Habbo CDN) — whichever is available and compatible
- Exact section sizes in tile dimensions per template
- Activity-linked furniture state implementation details
- Tool pattern heuristics as secondary classification signal

</decisions>

<specifics>
## Specific Ideas

- "In Habbo, some furniture can have passive/inactive states. For example, oil lamps can be turned off for no activity rooms, while active ones have them lit up" — use authentic Habbo furniture state toggling for section activity indication
- Classic Habbo teleport booth for spawn/despawn — the iconic cabinet, not a custom design
- Classic Habbo flash effect on teleport activation
- Roles should connect to agents/skills/plugins already defined in the `.claude/` project config, not invented from scratch
- The room should feel like one large office floor divided into team zones, not separate disconnected rooms

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-agent-factory-workflow-with-team-sections-and-orchestration-ui*
*Context gathered: 2026-03-08*
