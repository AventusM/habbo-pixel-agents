---
id: S21
milestone: M002
status: complete
---

# S21: Larger Room Sizes — Context

## Goal

Enlarge all room template sizes so agents have more workspace, with multi-row desk placement for larger sections.

## Why this Slice

The original room sizes (9×9, 11×11, 13×13) felt cramped with multiple agents and furniture. Larger rooms give agents more space to wander and sit, and better match the visual scale of the isometric renderer.

## Scope

### In Scope

- Increase TEMPLATE_SIZES for small (15×15), medium (19×19), large (25×25)
- Update desk placement to use two rows in sections with 9+ usable tiles
- Lower agent-count thresholds for size selection (small ≤8, medium ≤16)
- Increase idle wander radius from 5 to 8
- Update all roomLayoutEngine tests to match new dimensions

### Out of Scope

- New furniture types or layout patterns
- Room shape changes (still square templates)

## Constraints

- Must keep existing template generation logic and section assignment intact

## Integration Points

### Consumes

- `src/roomLayoutEngine.ts` — existing template generation and desk placement
- `src/idleWander.ts` — wander radius constant

### Produces

- Larger room templates with more usable space per section
- Multi-row desk placement for large sections
