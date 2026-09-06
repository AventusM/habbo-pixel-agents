# S04: Room Walls Kanban Notes

**Goal:** Replace per-tile wall strips with full room-perimeter wall panels that extend to a shared baseline, plus a back corner post where the two walls meet.
**Demo:** Replace per-tile wall strips with full room-perimeter wall panels that extend to a shared baseline, plus a back corner post where the two walls meet.

## Must-Haves


## Tasks

- [x] **T01: 12-room-walls-kanban-notes 01**
  - Replace per-tile wall strips with full room-perimeter wall panels that extend to a shared baseline, plus a back corner post where the two walls meet.

Purpose: Current wall strips leave visible gaps between tiles at different heights and look like thin edges rather than proper room walls. Full wall panels create the authentic Habbo Hotel room enclosure.

Output: `src/isoWallRenderer.ts` with wall geometry functions; updated `preRenderRoom` to call wall panels; unit tests.
- [x] **T02: 12-room-walls-kanban-notes 02** `est:5min`
  - Add GitHub Projects v2 integration to the extension host: fetch kanban cards via `gh api graphql`, send them to the webview via postMessage, and expose settings for configuring which project to sync.

Purpose: This provides the data pipeline for wall-mounted sticky notes. The extension host handles all GitHub API interaction; the webview only receives card data.

Output: `src/githubProjects.ts` with fetch logic, updated `agentTypes.ts` with message types, updated `extension.ts` with polling, updated `package.json` with settings schema, unit tests.
- [x] **T03: 12-room-walls-kanban-notes 03**
  - Render GitHub Projects kanban cards as wall-mounted sticky notes in the isometric room. Notes are drawn as screen-space overlays (like speech bubbles) after the depth-sorted render pass, positioned on the left and right wall surfaces.

Purpose: This is the visual payoff — cards from the GitHub Projects board appear as physical post-it notes on the office walls, making project status visible at a glance in the room.

Output: `src/isoKanbanRenderer.ts` with note rendering, updated `RoomCanvas.tsx` to receive kanban messages and render notes per frame, unit tests.

## Files Likely Touched

- `src/isoWallRenderer.ts`
- `src/isoTileRenderer.ts`
- `tests/isoWallRenderer.test.ts`
- `src/agentTypes.ts`
- `src/githubProjects.ts`
- `src/extension.ts`
- `package.json`
- `tests/githubProjects.test.ts`
- `src/isoKanbanRenderer.ts`
- `src/RoomCanvas.tsx`
- `tests/isoKanbanRenderer.test.ts`
