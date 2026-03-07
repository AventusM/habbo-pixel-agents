# Phase 17.1: Stray pixel diagnostic fix and right-click movement - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning
**Source:** User feedback after Phase 17 execution

<domain>
## Phase Boundary

Fix remaining stray pixel artifact near avatar and change interaction model to left-click=select, right-click=move.

</domain>

<decisions>
## Implementation Decisions

### Stray Pixel Investigation
- The clearRect tint canvas fix from 17-02 was applied and is in the build, but the stray pixel persists at direction 2 (facing camera)
- Static analysis traced ALL 13 sprite positions for direction 2 — none render below feet area (all y <= +23 relative to screen position)
- The tint canvas blit only copies (0, 0, frame.w, frame.h), so canvas residuals can't leak
- Root cause likely in the spritesheet PNG itself (stray artifact pixel) or a canvas compositing edge case
- Diagnostic approach: check face spritesheet PNG for stray pixels, add debug logging

### Right-Click Movement
- Left-click on avatar: open avatar builder panel (keep current behavior)
- Left-click on empty tile: select/deselect only (remove movement)
- Right-click on any tile: move nearest avatar to that tile (new behavior)
- Right-click should work regardless of whether builder panel is open

### Claude's Discretion
- Diagnostic script implementation details
- Exact contextmenu event handling approach
- Whether to preventDefault on contextmenu to suppress browser context menu

</decisions>

<specifics>
## Specific Ideas

- Use Node.js sharp or raw PNG parsing to scan face spritesheet for stray pixels outside frame bounds
- contextmenu event on canvas element for right-click detection
- Prevent default browser context menu on canvas right-click

</specifics>

<deferred>
## Deferred Ideas

None — both items are targeted fixes.

</deferred>

---

*Phase: 17.1-stray-pixel-diagnostic-fix-and-right-click-movement*
*Context gathered: 2026-03-07 via user feedback*
