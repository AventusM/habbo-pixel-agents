# Phase 16: Agent Factory Workflow with Team Sections and Orchestration UI - Research

**Researched:** 2026-03-08
**Domain:** Agent classification, multi-section room layout, VS Code webview sidebar, teleport effects
**Confidence:** MEDIUM

## Summary

Phase 16 is a large feature phase that transforms the single-room Habbo experience into a structured office floor with 4 team sections, adds intelligent agent classification from JSONL transcripts, introduces a VS Code sidebar orchestration panel, and implements teleport booth spawn/despawn effects. The phase touches nearly every layer of the codebase: the extension host (agent classification, JSONL parsing), the webview (room layout, avatars, furniture, UI overlays), and the VS Code extension API (sidebar panel registration).

The biggest technical risks are: (1) teleport booth furniture does NOT exist in cortex-assets -- the classic `hc_cab`, `teleport_door`, and all teleport furniture assets are absent from the CakeChloe/cortex-assets repository, requiring either sourcing from habboassets.com/CDN or creating placeholder sprites; (2) the room needs to be significantly larger (2x2 grid of sections) requiring camera pan/zoom which is currently listed as a v2 deferred requirement but is essential for navigating a large floor; (3) the orchestration sidebar requires a second webview (`WebviewViewProvider`) which runs independently from the main room webview panel, needing a messaging bridge.

**Primary recommendation:** Break this phase into 8-10 plans covering: floor layout engine, agent classification system, furniture expansion (non-teleport first), teleport booth with effects, role-based outfits, sidebar panel, agent naming/display, and camera navigation. Tackle the data model changes first (classification, naming) before visual features.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep auto-discovery from JSONL sessions (no manual factory)
- Classification is automatic: primary signal is `subagent_type` field from Task/Agent tool spawning
- For sessions without `subagent_type`, show a user prompt popup for manual classification -- immediate, no delay
- Assignment does NOT persist across VS Code sessions -- re-inferred fresh each time
- Different JSONL sessions = different agents (no role updating mid-session)
- User can click to reassign an agent's role/team after auto-classification
- Agent naming format: `<Role> - <Task>` (e.g., "Executor - Frontend", "Researcher - Auth")
- Role inferred from subagent_type or user popup; Task area inferred from initial prompt + file path activity
- Roles derived from `.claude/` config: GSD subagent types mapped to 4 high-level categories:
  - Planning: gsd-phase-researcher, gsd-planner, gsd-plan-checker, architects
  - Core Dev: gsd-executor, coders, testers
  - Infrastructure: gsd-codebase-mapper, DevOps tools, CI/CD
  - Support: gsd-debugger, gsd-verifier, documenters, refactorers
- Role-to-category mapping is predefined but configurable
- Single open-plan floor with visual dividers (rugs + thematic furniture + low wall partitions)
- 4 sections arranged in a 2x2 grid layout
- Sections connected by open doorways (1-2 tile-wide openings in partitions)
- All flat elevation (no height variation between sections)
- No shared/common areas -- just the 4 team sections
- 3 preset template sizes: Small (2-3 agents/section), Medium (4-6 agents), Large (8-10 agents)
- Smart default template selection based on project size/config; user can switch in settings
- Classic Habbo teleport cabinet furniture for spawn/despawn
- Each section has its own teleport booth
- Agents emerge from booth on spawn, walk to booth on despawn
- Classic Habbo flash/glow effect on teleport activation
- Section furniture themed per team (Planning: whiteboards/conference, Core Dev: desks/monitors, etc.)
- New furniture items expanded from cortex-assets (not limited to existing catalog)
- Furniture has activity-linked interactive states (monitors glow, whiteboards fill, lamps on/off)
- Role-based outfits: new clothing assets from cortex-assets, distinct per role
- Role-based accessories on top of outfit
- Customizable role-to-outfit mapping via extended Avatar Builder UI ("Role Outfits" tab)
- Role-specific idle behaviors: Coders sit at desks, Planners pace/sit at conference table, Researchers browse bookshelves
- Custom webview panel (not TreeView) in VS Code Activity Bar
- Habbo-themed pixel aesthetic matching the room view
- Side panel contains: agent list with status, section overview, activity log, quick actions
- Section list buttons for camera navigation (no minimap)
- Clicking an agent shows brief popup card + side panel scrolls to that agent
- Click-drag to pan, scroll wheel to zoom
- Default view: full floor overview (all 4 sections visible)
- Auto-follow toggle: camera tracks section with most activity; manual control when off
- Section jump buttons in side panel only (no room overlay)

### Claude's Discretion
- Infrastructure and Support section furniture choices
- Parent/child agent hierarchy visualization approach
- New clothing asset source (cortex-assets vs Habbo CDN) -- whichever is available and compatible
- Exact section sizes in tile dimensions per template
- Activity-linked furniture state implementation details
- Tool pattern heuristics as secondary classification signal

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.4 | Webview UI components | Already in project |
| vscode | ^1.80.0 | Extension API | Already in project, `WebviewViewProvider` for sidebar |
| Canvas 2D | N/A | All rendering | Project convention -- no PixiJS/WebGL |
| esbuild | ^0.27.3 | Bundling | Already configured for dual build |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^3.0.0 | Testing | All new modules need tests |
| happy-dom | ^20.7.0 | DOM mocking in tests | Test environment |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D glow effects | WebGL shaders | Would break project convention; Canvas filters sufficient for teleport flash |
| Custom heightmap for layout | JSON layout format | Heightmap is standard; JSON layout already has save/load support |
| TreeView for sidebar | WebviewViewProvider | User explicitly chose webview panel, not TreeView |

## Architecture Patterns

### Recommended Project Structure
```
src/
  agentClassifier.ts       # Role/team classification from JSONL + subagent_type
  agentTypes.ts             # Extended with role, team, taskArea fields
  agentManager.ts           # Extended with classification integration
  transcriptParser.ts       # Extended to extract subagent_type from Agent tool_use
  roomLayoutEngine.ts       # 2x2 grid layout generator with section boundaries
  sectionManager.ts         # Section state tracking (agent count, activity)
  teleportEffect.ts         # Teleport flash/glow Canvas 2D animation
  orchestrationPanel.ts     # WebviewViewProvider for sidebar
  orchestrationPanelHtml.ts # HTML/CSS/JS for sidebar webview content
  furnitureRegistry.ts      # Extended with new section-themed furniture
```

### Pattern 1: Agent Classification Pipeline
**What:** Parse JSONL transcripts to extract `subagent_type` from `Agent` tool_use blocks, map to role taxonomy, assign to team section.
**When to use:** Every time a new JSONL session is discovered.
**Example:**
```typescript
// The subagent_type field is in the Agent tool_use input
// From JSONL: {"type":"assistant","message":{"content":[{"type":"tool_use","name":"Agent","input":{"subagent_type":"gsd-executor",...}}]}}
interface AgentClassification {
  role: string;          // e.g., "gsd-executor"
  roleName: string;      // e.g., "Executor"
  team: TeamSection;     // e.g., "core-dev"
  taskArea: string;      // e.g., "Frontend" (inferred from prompt/files)
  displayName: string;   // e.g., "Executor - Frontend"
}

type TeamSection = 'planning' | 'core-dev' | 'infrastructure' | 'support';

const ROLE_TO_TEAM: Record<string, TeamSection> = {
  'gsd-phase-researcher': 'planning',
  'gsd-planner': 'planning',
  'gsd-plan-checker': 'planning',
  'gsd-executor': 'core-dev',
  'gsd-codebase-mapper': 'infrastructure',
  'gsd-debugger': 'support',
  'gsd-verifier': 'support',
};
```

### Pattern 2: VS Code Sidebar WebviewViewProvider
**What:** Register a custom webview in the Activity Bar sidebar that communicates with the main room webview panel.
**When to use:** For the orchestration panel.
**Example:**
```typescript
// package.json contributes section
{
  "viewsContainers": {
    "activitybar": [{
      "id": "habbo-orchestration",
      "title": "Habbo Agents",
      "icon": "media/habbo-icon.svg"
    }]
  },
  "views": {
    "habbo-orchestration": [{
      "type": "webview",
      "id": "habboPixelAgents.orchestrationPanel",
      "name": "Orchestration"
    }]
  }
}

// In extension.ts
class OrchestrationPanelProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [...] };
    webviewView.webview.html = this.getHtml(webviewView.webview);
  }
}

// Register in activate():
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    'habboPixelAgents.orchestrationPanel',
    new OrchestrationPanelProvider(context.extensionUri)
  )
);
```

### Pattern 3: Room Layout Templates
**What:** Generate heightmaps and furniture placements for 2x2 section grids at different sizes.
**When to use:** Room initialization based on template size setting.
**Example:**
```typescript
interface SectionLayout {
  team: TeamSection;
  originTile: { x: number; y: number };
  widthTiles: number;
  heightTiles: number;
  teleportTile: { x: number; y: number };
  furniture: FurnitureSpec[];
  deskTiles: { x: number; y: number; dir: number }[];
}

interface FloorTemplate {
  size: 'small' | 'medium' | 'large';
  totalWidth: number;   // tiles
  totalHeight: number;  // tiles
  sections: SectionLayout[];
  dividerTiles: { x: number; y: number }[]; // partition wall tiles
  doorwayTiles: { x: number; y: number }[]; // open passages
}

// Small: ~16x16, Medium: ~24x24, Large: ~32x32
```

### Pattern 4: Extension-to-Sidebar Messaging Bridge
**What:** The main webview panel and sidebar webview need to communicate. Both talk to the extension host, which relays messages between them.
**When to use:** Agent clicks in room need to scroll sidebar; section buttons in sidebar need to move camera.
**Example:**
```typescript
// Extension host acts as message broker
class MessageBridge {
  private roomPanel: vscode.WebviewPanel | null = null;
  private sidePanel: vscode.WebviewView | null = null;

  sendToRoom(msg: any) { this.roomPanel?.webview.postMessage(msg); }
  sendToSidebar(msg: any) { this.sidePanel?.webview.postMessage(msg); }

  // When sidebar sends 'jumpToSection', relay to room
  // When room sends 'agentClicked', relay to sidebar
}
```

### Anti-Patterns to Avoid
- **Modifying BFS/pathfinding algorithm:** Only the spawn/despawn destination changes (to teleport booth tile). The pathfinding itself stays unchanged.
- **Creating separate canvases per section:** The floor is ONE room with visual dividers, not 4 separate rooms. Single canvas, single depth sort.
- **Hardcoding section positions:** Use the template system. Section positions should be data-driven for the 3 size presets.
- **Direct sidebar-to-room communication:** Always go through extension host. Webviews cannot talk to each other directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar webview | Custom DOM injection | `WebviewViewProvider` API | VS Code standard, handles lifecycle |
| Agent classification taxonomy | Complex NLP on transcripts | Direct `subagent_type` field extraction | Field is explicitly set in Agent tool_use input |
| Room template layouts | Procedural room generation | 3 predefined templates (small/medium/large) | Predictable, testable, avoids layout bugs |
| Camera pan/zoom | Custom matrix transforms | Canvas 2D `translate()` + scale factor in renderState | Simple, already have camera origin pattern |
| Teleport flash effect | WebGL particle system | Canvas 2D radial gradient + alpha animation | Consistent with existing spawn effect pattern |

**Key insight:** The `subagent_type` field is already present in JSONL transcripts -- it's set in the `Agent` tool_use `input` object (e.g., `"subagent_type": "gsd-executor"`). No transcript analysis heuristics are needed for the primary classification signal. The existing `parseTranscriptLine()` already sees `tool_use` blocks but currently ignores the `input.subagent_type` field.

## Common Pitfalls

### Pitfall 1: Teleport Assets Missing from cortex-assets
**What goes wrong:** The classic Habbo teleport booth (`hc_cab`, `teleport_door`, `env_telep`, `bw_tele`) do NOT exist in CakeChloe/cortex-assets. All return 404.
**Why it happens:** cortex-assets has a curated subset of Habbo furniture, not the complete catalog.
**How to avoid:** Either: (a) source teleport sprites from Habbo CDN (habboassets.com) which has SWF/Nitro bundles, or (b) use `country_gate` as a visual stand-in (it exists in cortex-assets and is a door/gate), or (c) create simple pixel art placeholder sprites matching the Habbo style.
**Warning signs:** 404 errors during asset download.
**Recommendation:** Use `country_gate` (already downloaded) as the teleport booth visual. It's a gate/door that fits the "passage" concept. The teleport flash effect adds the magic feel regardless of the furniture sprite.

### Pitfall 2: Room Size vs Camera
**What goes wrong:** A 2x2 section grid with even the small template (~16x16 tiles, 1024x512 px) may not fit in the webview without scrolling. Medium/large templates definitely won't.
**Why it happens:** Camera panning was explicitly listed as a v2 deferred requirement. But Phase 16 requires navigating a multi-section floor.
**How to avoid:** Implement click-drag pan and scroll-wheel zoom as part of this phase. The user's CONTEXT.md explicitly requests "click-drag to pan, scroll wheel to zoom" so this is sanctioned.
**Warning signs:** Room renders but sections are off-screen.

### Pitfall 3: Two Webviews Need Shared State
**What goes wrong:** The sidebar webview (orchestration panel) and the main room webview are separate processes. They cannot share JavaScript state directly.
**Why it happens:** VS Code webviews are sandboxed iframes.
**How to avoid:** Extension host acts as message broker. Both webviews send messages to the extension host, which relays to the other. Keep the AgentManager in the extension host as the single source of truth.
**Warning signs:** Sidebar shows stale data, clicks in sidebar don't affect room.

### Pitfall 4: subagent_type Only Exists for Agent Tool Spawns
**What goes wrong:** Not all JSONL sessions are subagent spawns. The parent session (user-initiated) has no `subagent_type` field.
**Why it happens:** Only sessions created via the `Agent` tool_use have `subagent_type` in the spawning message. The parent session is the user's direct Claude Code session.
**How to avoid:** For sessions without `subagent_type`, show the immediate user prompt popup for manual classification (as specified in CONTEXT.md). Also use tool pattern heuristics as a secondary signal (Claude's discretion).
**Warning signs:** Parent sessions classified as "unknown" with no way to categorize them.

### Pitfall 5: Furniture Interactive States Need Per-Frame Rendering
**What goes wrong:** Activity-linked furniture states (monitors glowing, lamps on/off) require the furniture to be re-rendered per frame rather than using the OffscreenCanvas static cache.
**Why it happens:** Currently furniture is pre-rendered to OffscreenCanvas and composited once per frame. Dynamic furniture states would need to be in the dynamic render list instead.
**How to avoid:** Move "interactive" furniture items from the OffscreenCanvas static layer to the dynamic renderables list (same as avatars). Only static/non-interactive furniture stays in the pre-rendered cache.
**Warning signs:** Furniture appears to never change state, or changing state requires full room re-render.

### Pitfall 6: Room Layout Breaks Existing Save/Load
**What goes wrong:** The new template-based layout system may conflict with the existing save/load layout format.
**Why it happens:** Current layouts store furniture arrays and heightmaps. New layouts add section metadata.
**How to avoid:** Extend the layout JSON format with optional `sections` field. Keep backward compatibility with existing layouts.

## Code Examples

### Extracting subagent_type from JSONL
```typescript
// In transcriptParser.ts -- extend parseTranscriptLine()
// The subagent_type is in the Agent tool_use input:
// {"type":"assistant","message":{"content":[{"type":"tool_use","name":"Agent","input":{"subagent_type":"gsd-executor","prompt":"..."}}]}}
export function extractSubagentType(line: string): string | null {
  try {
    const entry = JSON.parse(line);
    if (entry.type === 'assistant' && entry.message?.content) {
      for (const block of entry.message.content) {
        if (block.type === 'tool_use' && block.name === 'Agent' && block.input?.subagent_type) {
          return block.input.subagent_type;
        }
      }
    }
    return null;
  } catch { return null; }
}
```

### Camera Pan/Zoom in Canvas
```typescript
// Add to renderState:
interface CameraState {
  panX: number;    // pixel offset from center
  panY: number;
  zoom: number;    // 1.0 = default, 0.5 = zoomed out, 2.0 = zoomed in
}

// In frame() render loop:
ctx.save();
ctx.translate(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
ctx.scale(camera.zoom, camera.zoom);
ctx.translate(-canvas.offsetWidth / 2 + camera.panX, -canvas.offsetHeight / 2 + camera.panY);
// ... draw everything ...
ctx.restore();

// Mouse handlers:
// mousedown: start drag, record startX/Y
// mousemove: if dragging, update panX/panY
// wheel: adjust zoom (clamp 0.25-2.0)
```

### Teleport Flash Effect
```typescript
// Canvas 2D radial gradient for teleport glow
function drawTeleportFlash(
  ctx: CanvasRenderingContext2D,
  screenX: number, screenY: number,
  progress: number, // 0.0 to 1.0
): void {
  const alpha = Math.sin(progress * Math.PI); // peaks at 0.5
  const radius = 40 + 20 * progress;

  const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
  gradient.addColorStop(0.5, `rgba(100, 200, 255, ${alpha * 0.4})`);
  gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX - radius, screenY - radius, radius * 2, radius * 2);
  ctx.restore();
}
```

### Section Boundary with Partition Walls
```typescript
// Low wall partitions as 1-tile-high void tiles with a wall-like furniture sprite
// Doorways are simply gaps in the partition line
interface SectionDivider {
  axis: 'horizontal' | 'vertical';
  startTile: { x: number; y: number };
  length: number; // tiles
  doorwayAt: number[]; // tile indices along the line where gaps exist
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single room, all agents wander freely | Multi-section floor, agents assigned to team zones | Phase 16 | Agents have purpose and spatial organization |
| Agents named "Claude 1", "Claude 2" | Named `<Role> - <Task>` from JSONL classification | Phase 16 | Meaningful identity tied to what agent does |
| Agent variant = visual only | Variant = role-based outfit | Phase 16 | Visual identity reflects function |
| No sidebar panel | Orchestration WebviewView in Activity Bar | Phase 16 | Command center for monitoring agents |
| Random spawn location | Teleport booth spawn in designated section | Phase 16 | Spatial coherence, Habbo authenticity |

**Important constraints from existing code:**
- `AvatarSpec` currently has `variant: 0|1|2|3|4|5` -- needs extension for role-based outfits
- `AgentState` in extension host has no classification data -- needs `role`, `team`, `taskArea` fields
- `AgentManager.trackAgent()` creates agents immediately -- needs classification step before spawn
- `DESK_TILES` in RoomCanvas.tsx is hardcoded -- needs to be section-aware
- The `webview.tsx` renders a single `RoomCanvas` with fixed `DEMO_HEIGHTMAP` -- needs template-based layout

## Open Questions

1. **Teleport Booth Asset Source**
   - What we know: cortex-assets does NOT have teleport furniture. `country_gate` is available and gate-like.
   - What's unclear: Whether habboassets.com SWF bundles can be extracted for the classic teleport cabinet.
   - Recommendation: Use `country_gate` as visual stand-in for v1 of this phase. The teleport flash effect provides the "magic" feel. If user wants the exact Habbo teleport cabinet later, it can be sourced from Habbo CDN in a follow-up.

2. **How Many New Furniture Items Are Needed**
   - What we know: User wants section-themed furniture (whiteboards, monitors, server racks, etc.) from cortex-assets
   - What's unclear: Exact cortex-assets inventory for items like whiteboards, monitor screens, server racks
   - Recommendation: Audit cortex-assets for available office/tech furniture. Map available items to section themes. Use existing items creatively (e.g., `tv_flat` as monitor, `hc_bkshlf` as bookshelf, `shelves_armas` as server rack, `hc_dsk` as workstation).

3. **Activity-Linked Furniture State Sprites**
   - What we know: Cortex-assets furniture JSON has `visualization` with multiple states (`state: 0, 1, ...`) for some items
   - What's unclear: Which specific items have multi-state sprites (on/off, active/inactive)
   - Recommendation: Check `hc_lmp`, `tv_flat`, `bazaar_c17_lamp` for state variations. If states don't exist in the sprite data, implement via Canvas 2D overlay effects (glow filter, tint change).

4. **Role-Based Clothing Assets**
   - What we know: 28 clothing items already in catalog. User wants distinct outfits per role.
   - What's unclear: Whether enough visual variety exists to make 4+ distinct role outfits
   - Recommendation: Use existing clothing catalog creatively. Assign outfit presets per role category (e.g., Planners get cardigans/formal, Coders get t-shirts/casual, etc.). Download additional cortex-assets figure items if current catalog is insufficient.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| N/A | Agent classification from subagent_type | unit | `npx vitest run tests/agentClassifier.test.ts -x` | Wave 0 |
| N/A | Task area inference from prompt/files | unit | `npx vitest run tests/agentClassifier.test.ts -x` | Wave 0 |
| N/A | Role-to-team mapping | unit | `npx vitest run tests/agentClassifier.test.ts -x` | Wave 0 |
| N/A | Room template generation (heightmap + furniture) | unit | `npx vitest run tests/roomLayoutEngine.test.ts -x` | Wave 0 |
| N/A | Section boundary calculation | unit | `npx vitest run tests/roomLayoutEngine.test.ts -x` | Wave 0 |
| N/A | Teleport effect animation progress | unit | `npx vitest run tests/teleportEffect.test.ts -x` | Wave 0 |
| N/A | Camera pan/zoom math | unit | `npx vitest run tests/cameraController.test.ts -x` | Wave 0 |
| N/A | Agent naming format | unit | `npx vitest run tests/agentClassifier.test.ts -x` | Wave 0 |
| N/A | Sidebar message relay | unit | `npx vitest run tests/messageBridge.test.ts -x` | Wave 0 |
| N/A | Extended transcript parser (subagent_type) | unit | `npx vitest run tests/transcriptParser.test.ts -x` | Exists (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/agentClassifier.test.ts` -- covers classification, naming, role mapping
- [ ] `tests/roomLayoutEngine.test.ts` -- covers template generation, section boundaries
- [ ] `tests/teleportEffect.test.ts` -- covers animation progress, Canvas mock
- [ ] `tests/cameraController.test.ts` -- covers pan/zoom math, clamp bounds
- [ ] `tests/messageBridge.test.ts` -- covers extension-sidebar-room message relay

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/agentManager.ts`, `src/agentTypes.ts`, `src/transcriptParser.ts` -- current agent discovery and tracking
- Codebase inspection: `src/RoomCanvas.tsx`, `src/webview.tsx` -- current rendering pipeline and layout
- Codebase inspection: `src/avatarManager.ts`, `src/avatarOutfitConfig.ts` -- avatar management and outfit system
- Codebase inspection: `src/furnitureRegistry.ts` -- current furniture catalog
- JSONL transcript samples from `~/.claude/projects/` -- confirmed `subagent_type` field in `Agent` tool_use input

### Secondary (MEDIUM confidence)
- VS Code WebviewViewProvider API -- [VS Code Extension API docs](https://code.visualstudio.com/api/extension-guides/webview)
- cortex-assets furniture availability -- verified via GitHub API and `furnidata.json`

### Tertiary (LOW confidence)
- Teleport furniture sourcing alternatives (habboassets.com SWF extraction) -- not verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using only existing project libraries
- Architecture: MEDIUM - multi-webview messaging pattern is new to this codebase
- Pitfalls: HIGH - verified teleport asset absence, confirmed JSONL structure
- Classification system: HIGH - verified `subagent_type` field exists in actual JSONL data

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain, 30-day validity)
