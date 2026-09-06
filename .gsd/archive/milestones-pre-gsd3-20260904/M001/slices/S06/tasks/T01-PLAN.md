# T01: 06-ui-overlays 01

**Slice:** S06 — **Milestone:** M001

## Description

Create the speech bubble renderer using pure Canvas 2D APIs (no sprites) to display agent log lines, tool names, and waiting states above avatar heads.

Purpose: Make agent activity legible at a glance without looking at the terminal — users should see what each agent is doing by reading the speech bubble.

Output: Working speech bubble renderer with word wrapping, waiting animation, and triangular tail anchored above avatar head position.

## Must-Haves

- [ ] "Speech bubble renders as white rounded rectangle with dark border above avatar head"
- [ ] "Waiting '...' bubble cycles 1-3 dots at 500ms intervals"
- [ ] "Text wraps to new line when width exceeds ~200px"

## Files

- `src/isoBubbleRenderer.ts`
- `tests/isoBubbleRenderer.test.ts`
- `tests/setup.ts`
