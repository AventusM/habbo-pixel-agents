# S06: Ui Overlays

**Goal:** Create the speech bubble renderer using pure Canvas 2D APIs (no sprites) to display agent log lines, tool names, and waiting states above avatar heads.
**Demo:** Create the speech bubble renderer using pure Canvas 2D APIs (no sprites) to display agent log lines, tool names, and waiting states above avatar heads.

## Must-Haves


## Tasks

- [x] **T01: 06-ui-overlays 01** `est:4min`
  - Create the speech bubble renderer using pure Canvas 2D APIs (no sprites) to display agent log lines, tool names, and waiting states above avatar heads.

Purpose: Make agent activity legible at a glance without looking at the terminal — users should see what each agent is doing by reading the speech bubble.

Output: Working speech bubble renderer with word wrapping, waiting animation, and triangular tail anchored above avatar head position.
- [x] **T02: 06-ui-overlays 02** `est:3min`
  - Create the name tag renderer using Canvas 2D rounded rectangles with semi-transparent backgrounds and colored status dots to show agent identity and state at a glance.

Purpose: Users should immediately identify which agent is which and what state each agent is in (idle, active, waiting, error) without reading logs.

Output: Working name tag renderer with status dot color mapping and pill-shaped background, rendering above speech bubbles.
- [x] **T03: 06-ui-overlays 03** `est:3min`
  - Bundle Press Start 2P font locally and configure webview HTML to load it before first render, ensuring pixel-crisp text rendering in speech bubbles and name tags with no FOUT (Flash of Unstyled Text).

Purpose: Authentic pixel-art aesthetic requires a pixel font. Loading font before canvas initialization prevents jarring visual flash when font switches from system fallback to pixel font.

Output: Press Start 2P font bundled, loaded via webview URI, and rendering in all UI overlays with no visual flash on load.

## Files Likely Touched

- `src/isoBubbleRenderer.ts`
- `tests/isoBubbleRenderer.test.ts`
- `tests/setup.ts`
- `src/isoNameTagRenderer.ts`
- `tests/isoNameTagRenderer.test.ts`
- `src/RoomCanvas.tsx`
- `src/extension.ts`
- `dist/webview-assets/PressStart2P-Regular.ttf`
- `package.json`
