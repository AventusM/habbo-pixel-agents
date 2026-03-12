# T02: 06-ui-overlays 02

**Slice:** S06 — **Milestone:** M001

## Description

Create the name tag renderer using Canvas 2D rounded rectangles with semi-transparent backgrounds and colored status dots to show agent identity and state at a glance.

Purpose: Users should immediately identify which agent is which and what state each agent is in (idle, active, waiting, error) without reading logs.

Output: Working name tag renderer with status dot color mapping and pill-shaped background, rendering above speech bubbles.

## Must-Haves

- [ ] "Name tag renders as semi-transparent dark pill above avatar head"
- [ ] "Status dot color reflects avatar state (green=idle, yellow=active, grey=waiting, red=error)"
- [ ] "Name tag always appears above speech bubble"

## Files

- `src/isoNameTagRenderer.ts`
- `tests/isoNameTagRenderer.test.ts`
- `src/RoomCanvas.tsx`
