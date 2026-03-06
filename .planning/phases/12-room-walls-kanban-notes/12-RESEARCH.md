# Phase 12: Room Walls & Kanban Notes - Research

**Researched:** 2026-03-05
**Domain:** Isometric Canvas 2D wall geometry / GitHub Projects v2 GraphQL API / VS Code extension settings / wall-mounted overlay rendering
**Confidence:** HIGH

---

## Summary

Phase 12 has two independent sub-systems that compose at the rendering layer. The **wall system** replaces the current thin parallelogram strips (which only cover the bottom edge of border tiles) with full-height wall panels that span the entire room perimeter. The **kanban system** fetches GitHub Projects v2 items via `gh api graphql` and renders them as wall-mounted sticky notes in isometric screen space.

The wall geometry upgrade is pure Canvas 2D math — no new libraries. The existing `WALL_HEIGHT = 128` constant and `drawLeftFace`/`drawRightFace` functions in `isoTileRenderer.ts` already establish the visual vocabulary; what changes is (1) where walls are drawn (room-edge columns/rows, not per-tile strips) and (2) the option to punch window cutouts into wall panels. Sticky notes are a new `Renderable`-adjacent overlay drawn in screen space after depth-sort (like speech bubbles), with their wall-coordinate origin computed from the room's left- and right-wall tile positions.

The GitHub Projects integration runs entirely in the extension host (Node.js) and communicates to the webview via the existing `postMessage` protocol. The `gh` CLI is already the project's standard auth mechanism (no OAuth flow). All data fetching uses `child_process.execSync`/`execFile` around `gh api graphql`, keeping zero npm dependencies for network I/O.

**Primary recommendation:** Build in three sequential waves: (1) full wall panels replacing strips, (2) GitHub Projects polling + message protocol, (3) sticky-note canvas rendering on wall surfaces.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D (browser built-in) | N/A | Wall panel geometry + sticky note rendering | Established Phase 2; painter's algorithm already in use |
| TypeScript | 5.x | Type-safe wall geometry + message types | Project-wide; already in use |
| `gh` CLI (system) | any recent | GitHub Projects GraphQL queries | Already the project's auth mechanism; no OAuth needed |
| `child_process` (Node built-in) | N/A | Execute `gh api graphql` from extension host | Zero extra deps; fits existing extension host pattern |
| VS Code `workspace.getConfiguration` | N/A | Read GitHub Project settings (org, project number) | Standard VS Code extension settings API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^3.0.0 | Unit tests for wall geometry math + message types | Already in use; covers pure functions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gh api graphql` via child_process | `@octokit/graphql` npm package | Octokit adds a dependency and needs a token wired up; `gh` CLI already has auth and is already assumed to be installed |
| VS Code `contributes.configuration` settings | Hardcoded or env vars | Settings UI is more discoverable and survives reload cleanly |
| Wall panels via per-tile strip concatenation | Explicit room-perimeter polygon | Per-tile strips leave seams at varying tile heights; explicit room-perimeter polygon is simpler and gap-free |

**Installation:**
No new npm packages required.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── isoTileRenderer.ts     # Wall panel draw functions added here (extends existing file)
├── isoWallRenderer.ts     # NEW: wall panel geometry — drawBackWall, drawLeftWall, drawRightWall
├── isoKanbanRenderer.ts   # NEW: sticky note rendering on wall surfaces
├── isoTypes.ts            # Add WallNote type and KanbanColumn type
├── agentTypes.ts          # Add kanban message types to ExtensionMessage union
└── extension.ts           # Add GitHub Projects polling, settings read, postMessage
```

### Pattern 1: Full Room-Perimeter Wall Panels (replacing per-tile strips)

**What:** Instead of drawing a wall strip under each border tile separately, draw three explicit polygons: a left wall panel (all tiles in column 0), a right wall panel (all tiles in row 0), and optionally a back corner pillar.

**When to use:** Room initialization — walls go into `preRenderRoom` alongside floor tiles.

**Geometry derivation** (using existing coordinate system):

The left wall face hangs below the **left edge of the grid** (tiles where `tx === 0` or left neighbor is void). In isometric projection:
- The left wall panel for the entire left column is a tall parallelogram whose top edge follows the tile rhombus left edges and whose bottom edge drops `WALL_HEIGHT` pixels straight down.
- Each tile at `(tx, ty)` contributes a left face strip from the left vertex `(sx - TILE_W_HALF, sy + TILE_H_HALF)` down to `(sx - TILE_W_HALF, sy + TILE_H_HALF + WALL_HEIGHT)` and from the bottom vertex `(sx, sy + TILE_H)` down to `(sx, sy + TILE_H + WALL_HEIGHT)`.
- These strips are already drawn per-tile in the current `drawLeftFace`/`drawRightFace` functions. For **full wall panels**, the improvement is to:
  1. Find the full extent of left-wall and right-wall edge tiles.
  2. Draw one continuous polygon tracing all top edges, then all bottom edges — eliminating visible seams between tiles at the same height.
  3. Alternatively (simpler): keep drawing per-tile strips but increase wall height to reach the visual "floor" of the room. The current approach already works; the main visual upgrade is height and consistent wall color.

**For the planner:** The simplest correct approach is to:
- Keep the per-tile strip approach (it already works and matches Habbo's own rendering)
- Increase visual fidelity by ensuring wall height is sufficient to fill to the canvas bottom for the deepest tiles
- Add a **back corner post** (the vertical pillar where left wall meets right wall at the top-back corner of the room)

```typescript
// Pattern: draw back wall corner post
// The back corner of the room is at tile (0, 0) — top-left in isometric view.
// tileToScreen(0, 0, 0) gives screen position of the back corner top vertex.
// The back post is a vertical rectangle from that point down WALL_HEIGHT pixels.

function drawBackCornerPost(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cameraOrigin: { x: number; y: number },
  hsb: HsbColor,
): void {
  const { x: sx, y: sy } = tileToScreen(0, 0, 0);
  const screenX = sx + cameraOrigin.x;
  const screenY = sy + cameraOrigin.y;
  // A thin vertical rectangle from the top vertex down
  const POST_W = 4; // pixels
  ctx.fillStyle = tileColors(hsb).left;
  ctx.fillRect(screenX - POST_W / 2, screenY, POST_W, WALL_HEIGHT);
}
```

### Pattern 2: Wall-Mounted Sticky Note (Kanban Card)

**What:** A sticky note is positioned on a wall face (left wall or right wall) at a given tile position along that wall. It renders as a colored Canvas 2D rectangle with truncated title text, drawn in screen space after the depth-sorted room geometry.

**When to use:** After GitHub Projects data is fetched and parsed; sticky notes are drawn as overlays (like speech bubbles) so they always appear on top of room geometry.

**Wall coordinate system:**
- Left wall tiles: `(0, ty)` for ty = 0..height-1 — the wall spans the left edge
- Right wall tiles: `(tx, 0)` for tx = 0..width-1 — the wall spans the right edge
- For a kanban with 3 columns (To Do, In Progress, Done), distribute notes across wall tiles evenly
- Screen position of a left-wall note at tile y=ty: `screenX = tileToScreen(0, ty, 0).x + TILE_W_HALF * 0.5` (on the left face), `screenY = tileToScreen(0, ty, 0).y + WALL_HEIGHT * 0.5` (midpoint of wall height)

**Note visual specification:**
- Width: ~48px, Height: ~36px (fits within a tile face)
- Background: column color (yellow for To Do, blue for In Progress, green for Done)
- Border: 1px dark stroke
- Text: 6px Press Start 2P (or fallback), max 2 lines of ~8 chars

```typescript
// Sticky note draw pattern (screen-space overlay, like drawSpeechBubble)
function drawStickyNote(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  title: string,
  columnColor: string,
): void {
  const W = 48, H = 36, PAD = 4;
  ctx.save();
  ctx.fillStyle = columnColor;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(screenX - W / 2, screenY - H / 2, W, H, 3);
  ctx.fill();
  ctx.stroke();

  // Title text (truncated)
  ctx.fillStyle = '#1a1a2e';
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  const truncated = title.length > 10 ? title.slice(0, 10) + '…' : title;
  ctx.fillText(truncated, screenX, screenY + 2);
  ctx.restore();
}
```

### Pattern 3: GitHub Projects Data Fetching (Extension Host)

**What:** From the extension host, shell out to `gh api graphql` to fetch project items, then `postMessage` the data to the webview.

**When to use:** On extension activate (if configured), then on a polling interval.

```typescript
// Extension host pattern — run in Node.js context
import { execSync } from 'child_process';

interface KanbanCard {
  id: string;
  title: string;
  status: string; // "Todo" | "In Progress" | "Done" | custom
}

function fetchProjectItems(org: string, projectNumber: number): KanbanCard[] {
  // Step 1: Get project node ID
  const idQuery = `query { organization(login: "${org}") { projectV2(number: ${projectNumber}) { id } } }`;
  const idResult = JSON.parse(
    execSync(`gh api graphql -f query='${idQuery}'`, { encoding: 'utf8' })
  );
  const projectId = idResult.data.organization.projectV2.id;

  // Step 2: Get items with status field
  const itemsQuery = `
    query {
      node(id: "${projectId}") {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { title }
                ... on PullRequest { title }
                ... on DraftIssue { title }
              }
              fieldValues(first: 10) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const result = JSON.parse(
    execSync(`gh api graphql -f query='${itemsQuery}'`, { encoding: 'utf8' })
  );

  const items = result.data.node.items.nodes;
  return items.map((item: any) => {
    const statusField = item.fieldValues.nodes.find(
      (fv: any) => fv?.field?.name === 'Status'
    );
    return {
      id: item.id,
      title: item.content?.title ?? '(no title)',
      status: statusField?.name ?? 'No Status',
    };
  });
}
```

**Error handling:** `execSync` throws if `gh` is not installed or auth fails. Wrap in try/catch; if it throws, log to console and send empty array to webview — silent degradation matches the audio fallback pattern established in Phase 8.

### Pattern 4: Extension↔Webview Message Protocol Extension

**What:** Add new message types to `agentTypes.ts` for kanban data.

```typescript
// Additions to agentTypes.ts

/** A single kanban card from GitHub Projects */
export interface KanbanCard {
  id: string;
  title: string;
  status: string; // raw status column name from GitHub Projects
}

// Add to ExtensionMessage union:
| { type: 'kanbanCards'; cards: KanbanCard[] }
```

**Webview:** `RoomCanvas.tsx` listens for `kanbanCards` message and stores it in a `useRef` (not `useState`) for access in the rAF loop — matching the established `useRef`-for-render-state pattern (ROOM-11 / Decisions Log).

### Pattern 5: VS Code Settings

**What:** Declare GitHub Project config in `package.json` contributes.configuration; read in extension.ts.

```json
// package.json contributes addition
"contributes": {
  "configuration": {
    "title": "Habbo Pixel Agents",
    "properties": {
      "habboPixelAgents.githubProject.org": {
        "type": "string",
        "default": "",
        "description": "GitHub organization or user login for kanban sync"
      },
      "habboPixelAgents.githubProject.projectNumber": {
        "type": "number",
        "default": 0,
        "description": "GitHub Projects project number (from the URL)"
      },
      "habboPixelAgents.githubProject.pollIntervalSeconds": {
        "type": "number",
        "default": 60,
        "description": "How often to refresh kanban cards (seconds, 0 = disabled)"
      }
    }
  }
}
```

```typescript
// extension.ts — reading settings
const config = vscode.workspace.getConfiguration('habboPixelAgents');
const org = config.get<string>('githubProject.org', '');
const projectNumber = config.get<number>('githubProject.projectNumber', 0);
const pollInterval = config.get<number>('githubProject.pollIntervalSeconds', 60);
```

### Anti-Patterns to Avoid

- **Re-rendering walls in the rAF loop:** Wall panels are static geometry — they belong in `preRenderRoom` on the OffscreenCanvas, not the per-frame loop. Only sticky notes (which can change) go in the per-frame pass.
- **Drawing sticky notes inside `depthSort`:** Sticky notes are screen-space overlays; they should be drawn after the depth-sorted list, exactly like speech bubbles and name tags (pattern from Phase 6, UI-06).
- **Using `useState` for kanban card data in webview:** All mutable render state goes in `useRef` (ROOM-11, Decisions Log). `kanbanCardsRef` not `setKanbanCards`.
- **Spawning `gh` in the webview (browser context):** `child_process` is Node.js only. GitHub API calls must stay in the extension host and be sent to webview via `postMessage`.
- **Hardcoding the status field name "Status":** Projects may rename this column. Fetch it dynamically by checking `field.name` against common variants ("Status", "Column") or make it a setting. Default to "Status" but don't fail silently if not found.
- **Embedding single-quotes in GraphQL queries passed to execSync:** Single-quote interpolation in shell strings is error-prone. Prefer writing the query to a temp file or using `gh api graphql --input -` with stdin, or escaping carefully.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub API auth | Custom OAuth flow | `gh` CLI (already authed) | gh CLI manages tokens; OAuth is out of scope per phase notes |
| HTTP client for GitHub API | `fetch` or `axios` | `gh api graphql` via child_process | No dependency; works in VS Code Node host; reuses existing auth |
| Isometric wall geometry | Novel polygon math | Extend existing `drawLeftFace`/`drawRightFace` | Current functions already produce correct Habbo wall parallelograms; extend them |
| Depth sorting for sticky notes | Custom sort logic | Draw sticky notes after `depthSort` pass (same as speech bubbles) | Established pattern from Phase 6 (UI-06); no sort key needed |
| Text wrapping for note titles | Custom word-wrap | Truncate to fixed char count + ellipsis | Press Start 2P at 5px is tiny; 10-char truncation is sufficient for notes |

**Key insight:** Both sub-systems (walls and kanban) reuse existing abstractions almost entirely. Walls extend `isoTileRenderer.ts`; kanban extends the `agentTypes.ts` message protocol and overlays extend the speech bubble pattern.

---

## Common Pitfalls

### Pitfall 1: Wall Strips at Different Tile Heights Leave Gaps

**What goes wrong:** Tiles at height > 0 render their wall strip at a higher screen Y than their height-0 neighbors. A wall strip at tile (0, 2, height=2) starts 32px above the wall strip at tile (0, 3, height=0), leaving a visible gap between them.
**Why it happens:** The current per-tile strip draw stops at `sy + TILE_H + WALL_HEIGHT`. The strip for the higher tile ends before the strip for the lower tile starts.
**How to avoid:** For left and right wall columns, compute the **lowest screen Y** across all tiles in that column/row and extend the wall strip downward to that shared baseline. OR draw the wall as a continuous polygon from the first tile edge down to a fixed canvas-bottom baseline.
**Warning signs:** Visible horizontal gaps in the wall where the heightmap changes height level.

### Pitfall 2: gh CLI Not Installed or Not Authenticated

**What goes wrong:** `execSync('gh api graphql ...')` throws `ENOENT` or exits with a non-zero code if `gh` is not installed or `gh auth login` has not been run.
**Why it happens:** VS Code extension hosts inherit the user's shell PATH and auth state, which may not include `gh`.
**How to avoid:** Wrap all `execSync` calls in try/catch. On failure, log to console and send `{ type: 'kanbanCards', cards: [] }` to webview. Show no error UI to user (audio fallback pattern from Phase 8).
**Warning signs:** Extension crashes or webview shows error state when GitHub settings are configured but `gh` is unavailable.

### Pitfall 3: Single-Quote Escaping in Inline GraphQL Queries

**What goes wrong:** `execSync("gh api graphql -f query='query { ... }'")` — if the GraphQL query itself contains single quotes, the shell string breaks.
**Why it happens:** Shell interpolation of inline strings is fragile.
**How to avoid:** Write the query to a temp file (`/tmp/habbo-gql-query.graphql`) and use `gh api graphql --input /tmp/habbo-gql-query.graphql`, or use `fs.writeFileSync` + `execSync` pattern. Alternatively, use `execFile` with an args array to avoid shell interpolation entirely.
**Warning signs:** `SyntaxError: Unexpected token` from `gh` when query contains special characters.

### Pitfall 4: Sticky Notes Bleeding Off Wall Edges

**What goes wrong:** If a wall has only 2 tiles (short room) but 10 kanban cards, notes are placed at screen positions that go past the visible wall area.
**Why it happens:** Note placement logic divides cards evenly across wall tiles without clamping.
**How to avoid:** Cap the number of visible notes at `wallTileCount * cardsPerTile` (e.g., 2 notes per tile). Excess notes are not rendered (users can configure which project to sync to control card count).
**Warning signs:** Sticky notes appearing on floor tiles or outside the canvas.

### Pitfall 5: preRenderRoom Called Before kanban Data Available

**What goes wrong:** Walls are on the OffscreenCanvas (pre-rendered once) but sticky notes need live data that arrives after the initial render. If notes are baked into the OffscreenCanvas, they can't update without a full re-render.
**Why it happens:** Conflating static geometry (walls) with dynamic data (kanban cards).
**How to avoid:** Walls go on the OffscreenCanvas. Sticky notes are drawn per-frame in the rAF loop as screen-space overlays (after the `depthSort` pass), exactly like speech bubbles. When `kanbanCardsRef.current` changes, the next frame automatically picks up the new data.
**Warning signs:** Sticky notes only update when the extension restarts (sign they're in the OffscreenCanvas).

### Pitfall 6: Polling Interval Uses setInterval Without Cleanup

**What goes wrong:** `setInterval` for kanban polling is not cleared when the webview panel is disposed, causing memory leaks and continued API calls after the panel closes.
**Why it happens:** Forgetting to add the interval to cleanup in `panel.onDidDispose`.
**How to avoid:** Store the interval ID and clear it in the `onDidDispose` callback. Follow the `runningRef.current = false` + `cancelAnimationFrame` pattern (ROOM-10).
**Warning signs:** Multiple polling intervals stacking up on each open/close cycle.

---

## Code Examples

### Left Wall Screen Position for Note Placement
```typescript
// Source: derived from existing tileToScreen + WALL_HEIGHT in isoTileRenderer.ts

/**
 * Compute screen position for a sticky note on the left wall at tile row ty.
 * The note is centered on the wall face, midway down the wall height.
 */
function leftWallNotePosition(
  ty: number,
  cameraOrigin: { x: number; y: number },
): { x: number; y: number } {
  const { x: sx, y: sy } = tileToScreen(0, ty, 0);
  // Left face midpoint: the left vertex of the rhombus, shifted right by TILE_W_HALF * 0.25
  // and down by TILE_H_HALF + WALL_HEIGHT * 0.4 (roughly 40% down the wall)
  return {
    x: sx + cameraOrigin.x - TILE_W_HALF * 0.5,
    y: sy + cameraOrigin.y + TILE_H_HALF + WALL_HEIGHT * 0.4,
  };
}

/**
 * Compute screen position for a sticky note on the right wall at tile col tx.
 */
function rightWallNotePosition(
  tx: number,
  cameraOrigin: { x: number; y: number },
): { x: number; y: number } {
  const { x: sx, y: sy } = tileToScreen(tx, 0, 0);
  return {
    x: sx + cameraOrigin.x + TILE_W_HALF * 0.5,
    y: sy + cameraOrigin.y + TILE_H_HALF + WALL_HEIGHT * 0.4,
  };
}
```

### GitHub Projects GraphQL Query (via gh CLI)
```typescript
// Source: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects

import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function fetchKanbanCards(org: string, projectNumber: number): KanbanCard[] {
  try {
    // Step 1: resolve project node ID
    const idResult = JSON.parse(
      execFileSync('gh', [
        'api', 'graphql',
        '-f', `query=query { organization(login: "${org}") { projectV2(number: ${projectNumber}) { id } } }`,
      ], { encoding: 'utf8' })
    );
    const projectId: string = idResult.data.organization.projectV2.id;

    // Step 2: fetch items with status
    const itemsQuery = `
      query {
        node(id: "${projectId}") {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue { title }
                  ... on PullRequest { title }
                  ... on DraftIssue { title }
                }
                fieldValues(first: 10) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Write query to temp file to avoid shell quoting issues
    const tmpFile = path.join(os.tmpdir(), 'habbo-gql-query.graphql');
    fs.writeFileSync(tmpFile, itemsQuery, 'utf8');

    const itemsResult = JSON.parse(
      execFileSync('gh', ['api', 'graphql', '--input', tmpFile], { encoding: 'utf8' })
    );

    const nodes = itemsResult.data.node.items.nodes as any[];
    return nodes.map(node => ({
      id: node.id as string,
      title: (node.content?.title ?? '(no title)') as string,
      status: (node.fieldValues.nodes.find(
        (fv: any) => fv?.field?.name === 'Status'
      )?.name ?? 'No Status') as string,
    }));
  } catch (err) {
    console.error('[habbo-pixel-agents] GitHub Projects fetch failed:', err);
    return [];
  }
}
```

### Kanban Color Map (Status → Color)
```typescript
// Standard kanban column colors — matches typical GitHub Projects defaults
const KANBAN_COLORS: Record<string, string> = {
  'Todo':        '#fef08a', // yellow
  'In Progress': '#93c5fd', // blue
  'Done':        '#86efac', // green
  'No Status':   '#e5e7eb', // grey
};

function statusToColor(status: string): string {
  return KANBAN_COLORS[status] ?? '#e5e7eb';
}
```

### VS Code Settings Read Pattern
```typescript
// Source: https://code.visualstudio.com/api/references/contribution-points

// In extension.ts, after webview is created:
const config = vscode.workspace.getConfiguration('habboPixelAgents');
const org = config.get<string>('githubProject.org', '');
const projectNumber = config.get<number>('githubProject.projectNumber', 0);
const pollIntervalSeconds = config.get<number>('githubProject.pollIntervalSeconds', 60);

let pollIntervalId: NodeJS.Timeout | undefined;

if (org && projectNumber > 0) {
  // Initial fetch
  const cards = fetchKanbanCards(org, projectNumber);
  panel.webview.postMessage({ type: 'kanbanCards', cards });

  // Polling
  if (pollIntervalSeconds > 0) {
    pollIntervalId = setInterval(() => {
      const cards = fetchKanbanCards(org, projectNumber);
      panel.webview.postMessage({ type: 'kanbanCards', cards });
    }, pollIntervalSeconds * 1000);
  }
}

panel.onDidDispose(() => {
  if (pollIntervalId) clearInterval(pollIntervalId);
  agentManager.dispose();
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-tile wall strips (edge tiles only) | Full wall panel per wall surface | Phase 12 | No visual seams; correct Habbo room appearance |
| No room data on walls | Wall-mounted sticky notes as kanban | Phase 12 | Physical kanban board in the virtual room |
| No GitHub integration | GitHub Projects v2 via gh CLI | Phase 12 | Cards sync automatically every N seconds |

**Note on GitHub Projects v2 API:** As of September 2025, GitHub released a REST API for Projects v2 (`/repos/{owner}/{repo}/projects` and related). However, the REST API has limited field value support compared to GraphQL. GraphQL remains the recommended approach for reading item status fields. The `gh api graphql` CLI command covers this perfectly without additional dependencies.

---

## Open Questions

1. **Personal repos vs organization repos**
   - What we know: The GraphQL query uses `organization(login: "...")` for org repos. Personal repos use `user(login: "...")` instead.
   - What's unclear: Phase description says "repo + project number" — projects can be org-level or user-level; repo-level projects (classic Projects) are a third variant.
   - Recommendation: Support both org and user query paths. Add a `githubProject.ownerType` setting with values `"org"` | `"user"`, defaulting to `"org"`. The code forks at the GraphQL query level only.

2. **How many cards to show on the wall?**
   - What we know: A typical office room is ~10×10 tiles. Left wall has ~8 tile rows, right wall has ~8 tile columns. At 2 notes per tile, max ~32 notes are visible.
   - What's unclear: Should overflow be hidden or scrollable?
   - Recommendation: Show the most recently updated N items (N = wall capacity). No scroll — isometric canvas is not a list UI. Users configure which project to sync; if a project has 50+ cards, they should filter it.

3. **Window cutouts in walls**
   - What we know: The phase description calls this "optional." Habbo window furni is a wall-mounted sprite placed on the wall face.
   - What's unclear: Whether this phase should include window sprites from cortex-assets or just a Canvas 2D cutout shape.
   - Recommendation: Implement as plain Canvas 2D cutout (a darker rectangle on the wall panel) for Phase 12. Full wall-furni sprites are a follow-on. This keeps the phase self-contained.

4. **CSP for execFileSync in extension host**
   - What we know: `execFileSync` runs in the extension host (Node.js), not the webview. No CSP changes are needed for the extension host.
   - What's unclear: Nothing — this is confirmed by existing pattern (AgentManager already watches files via Node.js APIs).
   - Recommendation: No CSP changes needed. Only confirm `connect-src` in webview CSP is not affected (it isn't, since no network calls happen in the webview).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/isoWallRenderer.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (Wall-01) | Left wall note screen position returns numeric coords | unit | `npx vitest run tests/isoWallRenderer.test.ts` | Wave 0 gap |
| (Wall-02) | Right wall note screen position returns numeric coords | unit | `npx vitest run tests/isoWallRenderer.test.ts` | Wave 0 gap |
| (Wall-03) | `statusToColor` returns correct hex for known statuses | unit | `npx vitest run tests/isoKanbanRenderer.test.ts` | Wave 0 gap |
| (Kanban-01) | `fetchKanbanCards` returns empty array when gh throws | unit (mock execFileSync) | `npx vitest run tests/githubProjects.test.ts` | Wave 0 gap |
| (Msg-01) | `kanbanCards` message type present in ExtensionMessage union | type-level (TypeScript) | `npm run typecheck` | After agentTypes.ts update |
| (Reg-01) | Full test suite passes (no regressions) | regression | `npx vitest run` | Existing |

### Sampling Rate
- **Per task commit:** `npx vitest run` (full suite — all tests complete in < 5s)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/isoWallRenderer.test.ts` — covers wall position math (Wall-01, Wall-02)
- [ ] `tests/isoKanbanRenderer.test.ts` — covers statusToColor and note layout (Wall-03)
- [ ] `tests/githubProjects.test.ts` — covers fetchKanbanCards error handling (Kanban-01); mock `execFileSync`

---

## Sources

### Primary (HIGH confidence)
- `/src/isoTileRenderer.ts` — Current `drawLeftFace`, `drawRightFace`, `WALL_HEIGHT = 128`; established wall geometry patterns
- `/src/isoTypes.ts` — `Renderable` interface, `depthSort` formula, `tileColors`
- `/src/agentTypes.ts` — Current `ExtensionMessage` union; pattern for extending protocol
- `/src/extension.ts` — Current webview setup, `postMessage` pattern, CSP policy
- `/src/isometricMath.ts` — `tileToScreen` formula; confirmed `TILE_W_HALF = 32`, `TILE_H_HALF = 16`
- `https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects` — GitHub Projects v2 GraphQL API; project ID lookup + items with field values query structure (HIGH — official docs)
- `https://code.visualstudio.com/api/references/contribution-points` — VS Code `contributes.configuration` schema; `getConfiguration` API (HIGH — official docs)

### Secondary (MEDIUM confidence)
- `https://some-natalie.dev/blog/graphql-intro/` — `fieldValueByName` shorthand pattern for querying status directly; confirmed against official docs
- `https://devopsjournal.io/blog/2022/11/28/github-graphql-queries` — `gh api graphql` command syntax with `-H "X-Github-Next-Global-ID: 1"` header for newer node IDs

### Tertiary (LOW confidence)
- WebSearch results on isometric wall rendering — no authoritative isometric wall vertex reference found; geometry derived from existing `drawLeftFace`/`drawRightFace` implementation in the codebase (which is itself HIGH confidence as it already produces correct Habbo walls)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new npm dependencies; all tools (gh, child_process, VS Code API, Canvas 2D) already in use or built-in
- Architecture: HIGH — Wall geometry directly extends proven existing functions; kanban overlay follows Phase 6 speech bubble pattern exactly; message protocol extension follows existing union type
- Pitfalls: HIGH — Derived from actual codebase patterns (WALL_HEIGHT, wall strip per-tile logic, rAF cleanup, OffscreenCanvas pre-render) and confirmed API failure modes (gh not installed)
- GitHub API: MEDIUM-HIGH — GraphQL query structure verified against official docs; `gh api graphql` pattern confirmed working; field value structure for single-select (Status) is documented

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (GitHub Projects API is stable; VS Code API is stable; 30-day window)
